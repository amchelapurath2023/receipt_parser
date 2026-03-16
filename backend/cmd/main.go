package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/textract"
	"github.com/aws/aws-sdk-go-v2/service/textract/types"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/websocket/v2"
)

type Client struct {
	Conn *websocket.Conn
}

type LineItem struct {
	Item  string  `json:"item_name"`
	Price float64 `json:"price"`
}

type ReceiptResponse struct {
	Items    []LineItem `json:"items"`
	Subtotal float64    `json:"subtotal"`
	Total    float64    `json:"total"`
	Tax      float64    `json:"tax"`
	Matches  bool       `json:"matches"`
}

type TextractResult struct {
	Response *textract.AnalyzeExpenseOutput
	Err      error
}

type UserCountMessage struct {
	Type    string `json:"type"`
	Payload struct {
		Count int `json:"count"`
	} `json:"payload"`
}

var (
	rooms      = make(map[string][]*Client)
	roomStates = make(map[string][]byte)
	roomsMu    sync.Mutex
)

func broadcastUserCount(sessionID string) {
	roomsMu.Lock()
	count := len(rooms[sessionID])
	clients := rooms[sessionID]
	roomsMu.Unlock()

	msg := UserCountMessage{Type: "users"}
	msg.Payload.Count = count

	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	for _, cl := range clients {
		_ = cl.Conn.WriteMessage(websocket.TextMessage, data)
	}
}

func isCouponCode(s string) bool {
	if s[0] == '/' {
		s = s[1:]
	}
	_, err := strconv.ParseFloat(s, 64)
	return err == nil
}

func main() {
	app := fiber.New()
	code := fiber.StatusInternalServerError

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
		AllowMethods: "GET,POST,OPTIONS",
	}))

	app.Use(limiter.New(limiter.Config{
		Max:        1000,
		Expiration: 1 * time.Minute,
	}))

	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	app.Post("/upload", func(c *fiber.Ctx) error {
		file, err := c.FormFile("receipt")
		if err != nil {
			log.Printf("File upload error: %v", err)
			return c.Status(code).SendString("File could not be uploaded")
		}

		stream, err := file.Open()
		if err != nil {
			log.Printf("File open error: %v", err)
			return c.Status(code).SendString("File could not be opened")
		}
		defer stream.Close()

		ctx := context.TODO()
		cfg, err := config.LoadDefaultConfig(ctx)
		if err != nil {
			log.Printf("AWS config error: %v", err)
			return c.Status(code).SendString("Couldn't get AWS configs")
		}

		textractClient := textract.NewFromConfig(cfg)

		buf := bytes.NewBuffer(nil)
		if _, err := io.Copy(buf, stream); err != nil {
			log.Printf("File copy error: %v", err)
			return c.Status(code).SendString("File was probably too large")
		}

		resp, err := textractClient.AnalyzeExpense(ctx, &textract.AnalyzeExpenseInput{
			Document: &types.Document{
				Bytes: buf.Bytes(),
			},
		})

		if err != nil {
			log.Printf("Textract error: %v", err)
			return c.Status(code).SendString("File couldn't be parsed")
		}

		if len(resp.ExpenseDocuments) == 0 {
			log.Printf("No expense documents found")
			return c.Status(code).SendString("No receipt data found")
		}

		var items []LineItem
		var subtotal float64
		var tax float64
		var total float64
		var cumSum float64

		var wg sync.WaitGroup
		wg.Add(2)

		go func() {
			defer wg.Done()
			for _, field := range resp.ExpenseDocuments[0].SummaryFields {
				fieldType := aws.ToString(field.Type.Text)
				if fieldType == "TAX" {
					tax, _ = strconv.ParseFloat(aws.ToString(field.ValueDetection.Text), 64)
				}
				if fieldType == "TOTAL" {
					total, _ = strconv.ParseFloat(aws.ToString(field.ValueDetection.Text), 64)
				}
				if fieldType == "SUBTOTAL" {
					subtotal, _ = strconv.ParseFloat(aws.ToString(field.ValueDetection.Text), 64)
				}
			}
			if total == 0 {
				total = subtotal + tax
			}
		}()
		var coupon bool
		go func() {
			defer wg.Done()

			if len(resp.ExpenseDocuments[0].LineItemGroups) == 0 {
				return
			}

			for _, lineItem := range resp.ExpenseDocuments[0].LineItemGroups[0].LineItems {
				var itemName string
				var itemPrice float64
				for _, field := range lineItem.LineItemExpenseFields {
					fieldType := aws.ToString(field.Type.Text)
					fieldValue := aws.ToString(field.ValueDetection.Text)
					if fieldType == "ITEM" {
						if isCouponCode(fieldValue) {
							coupon = true
						}
						itemName = fieldValue
					}
					if fieldType == "PRICE" {
						fields := strings.Fields(fieldValue)
						if coupon == true {
							if len(fields) > 0 {
								clean := fields[0]
								itemPrice, _ = strconv.ParseFloat(clean, 64)
							}
						}
						if len(fields) > 0 {
							clean := fields[0]
							itemPrice, _ = strconv.ParseFloat(clean, 64)
						}
					}
				}
				if coupon {
					cumSum -= itemPrice
					items[len(items)-1].Price -= itemPrice
					coupon = false
				} else {
					cumSum += itemPrice
					items = append(items, LineItem{Item: itemName, Price: itemPrice})
				}
			}
		}()

		wg.Wait()

		matches := false
		if subtotal > 0 {
			matches = (subtotal-cumSum) < 0.01 && (subtotal-cumSum) > -0.01
		}

		response := ReceiptResponse{
			Items:    items,
			Subtotal: subtotal,
			Total:    total,
			Tax:      tax,
			Matches:  matches,
		}

		return c.JSON(response)
	})

	app.Get("/ws/:session", websocket.New(func(c *websocket.Conn) {
		sessionID := c.Params("session")
		client := &Client{Conn: c}

		roomsMu.Lock()
		rooms[sessionID] = append(rooms[sessionID], client)

		// Send current state to new client
		if state, exists := roomStates[sessionID]; exists {
			_ = c.WriteMessage(websocket.TextMessage, state)
		}
		roomsMu.Unlock()

		// Broadcast updated user count
		broadcastUserCount(sessionID)

		defer func() {
			roomsMu.Lock()
			clients := rooms[sessionID]
			for i, cl := range clients {
				if cl == client {
					rooms[sessionID] = append(clients[:i], clients[i+1:]...)
					break
				}
			}
			if len(rooms[sessionID]) == 0 {
				delete(rooms, sessionID)
				delete(roomStates, sessionID)
			}
			roomsMu.Unlock()

			// Broadcast updated user count after disconnect
			broadcastUserCount(sessionID)

			c.Close()
		}()

		for {
			mt, msg, err := c.ReadMessage()
			if err != nil {
				break
			}

			roomsMu.Lock()
			roomStates[sessionID] = msg

			for _, cl := range rooms[sessionID] {
				if cl != client {
					_ = cl.Conn.WriteMessage(mt, msg)
				}
			}
			roomsMu.Unlock()
		}
	}, websocket.Config{
		Origins: []string{"*"},
	}))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	app.Listen("0.0.0.0:" + port)
}
