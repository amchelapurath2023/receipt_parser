package main

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/aws/aws-sdk-go-v2/service/textract"
	"github.com/aws/aws-sdk-go-v2/service/textract/types"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/aws"
	"context"
	"bytes"
	"io"
	"strings"
	"strconv"
	"sync"
	"time"
	"os"
	"net/http"
)

type Client struct{
	Conn *websocket.Conn
}

type LineItem struct {
	Item string `json:"item_name"`
	Price float64 `json:"price"`
}

type ReceiptResponse struct {
	Items []LineItem `json:"items"`
	Subtotal float64 `json:"subtotal"`
	Total float64 `json:"total"`
	Tax float64 `json:"tax"`
	Matches bool `json:"matches"`
}

type TextractResult struct {
	Response *textract.AnalyzeExpenseOutput
	Err error
}

var (
	rooms = make(map[string][]*Client)
	roomsMu sync.Mutex
)

func main(){
	app := fiber.New()
	code := fiber.StatusInternalServerError

	app.Use(cors.New(cors.Config{
		AllowOrigins: "https://backend-receiptparser-production.up.railway.app, http://localhost:8080",
		AllowHeaders: "Origin, Content-Type, Accept",
		AllowMethods: "GET,POST,OPTIONS",
	}))

	app.Use(limiter.New(limiter.Config{
		Max: 5,
		Expiration: 1 * time.Minute,
	}))
	
	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})
	

	app.Post("/upload", func(c *fiber.Ctx) error {
		file, err := c.FormFile("receipt")
		if err != nil {
			return c.Status(code).SendString("File could not be uploaded")
		}

		stream, err := file.Open()
		if err != nil {
			return c.Status(code).SendString("File could not be opened")
		}

		ctx := context.TODO()
		cfg, err := config.LoadDefaultConfig(ctx)
		if err != nil {
			return c.Status(code).SendString("Couldn't get AWS configs")
		}

		textractClient := textract.NewFromConfig(cfg)

		buf := bytes.NewBuffer(nil)
		if _, err := io.Copy(buf, stream); err != nil {
			return c.Status(code).SendString("File was probably too large")
		}

		resp, err := textractClient.AnalyzeExpense(ctx, &textract.AnalyzeExpenseInput{
			Document: &types.Document{
				Bytes: buf.Bytes(),
			},
		})


		if err != nil {
			return c.Status(code).SendString("File couldn't be parsed")
		}

		var items []LineItem
		var subtotal float64
		var tax float64
		var total float64
		cum_sum := 0.0

		var wg sync.WaitGroup
		wg.Add(2)
		
		go func() {
			defer wg.Done()
			for _, field := range resp.ExpenseDocuments[0].SummaryFields {
				if aws.ToString(field.Type.Text) == "TAX" {
					tax, _ = strconv.ParseFloat(aws.ToString(field.ValueDetection.Text), 64)
				}
				if aws.ToString(field.Type.Text) == "TOTAL" {
					total, _ = strconv.ParseFloat(aws.ToString(field.ValueDetection.Text), 64)
				}
				if aws.ToString(field.Type.Text) == "SUBTOTAL"{
					subtotal, _ = strconv.ParseFloat(aws.ToString(field.ValueDetection.Text), 64)
				}
				if tax != 0 && subtotal !=0 {
					break
				}
			}
			if total == 0 {
				total = subtotal+tax
			}

		}()

		go func() {
			defer wg.Done()
		
			for _, lineItem := range resp.ExpenseDocuments[0].LineItemGroups[0].LineItems {
				var itemName string
				var itemPrice float64
				for _, field := range lineItem.LineItemExpenseFields {
					fieldType := aws.ToString(field.Type.Text)
					fieldValue := aws.ToString(field.ValueDetection.Text)
					if fieldType == "ITEM" {
						itemName = fieldValue
					}
					if fieldType == "PRICE" {
						fields := strings.Fields(fieldValue)
						clean := fields[0]
						itemPrice, _ = strconv.ParseFloat(clean, 64)
					}
				}
				cum_sum += itemPrice
				items = append(items, LineItem{Item: itemName, Price: itemPrice})
			}
		}()

		wg.Wait()

		matches := (subtotal - cum_sum) < 0.01

		response := ReceiptResponse{
			Items:   items,
			Subtotal:   subtotal,
			Total:   total,
			Tax:     tax,
			Matches: matches,
		}

		return c.JSON(response)
	})

	app.Get("/ws/:session", websocket.New(func(c *websocket.Conn) {
		sessionID := c.Params("session")
		client := &Client{Conn: c}

		roomsMu.Lock()
		rooms[sessionID] = append(rooms[sessionID], client)
		roomsMu.Unlock()

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
			}
			roomsMu.Unlock()
			c.Close()
		}()

		for {
			mt, msg, err := c.ReadMessage()
			if err != nil {
				break
			}
			// Broadcast to room
			roomsMu.Lock()
			for _, cl := range rooms[sessionID] {
				if cl != client {
					_ = cl.Conn.WriteMessage(mt, msg)
				}
			}
			roomsMu.Unlock()
		}
	}, websocket.Config{
		// Use "Origins" with a wildcard to allow all devices to connect
		Origins: []string{"*"}, 
	}))

	port := os.Getenv("PORT")
    if port == "" {
        port = "8000" 
    }

    app.Listen("0.0.0.0:" + port)

}
