package main

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
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
		AllowOrigins: "http://localhost:3000",
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

		resultChan := make(chan TextractResult, 1)
		var wg sync.WaitGroup
		wg.Add(1)

		// Run AnalyzeExpense in goroutine
		go func() {
			defer wg.Done()
			resp, err := textractClient.AnalyzeExpense(ctx, &textract.AnalyzeExpenseInput{
				Document: &types.Document{
					Bytes: buf.Bytes(),
				},
			})
			resultChan <- TextractResult{Response: resp, Err: err}
		}()

		wg.Wait()
		close(resultChan)

		result := <-resultChan
		if result.Err != nil {
			return c.Status(code).SendString("File couldn't be parsed")
		}
		resp := result.Response

		var items []LineItem
		var tax float64
		var total float64

		for _, field := range resp.ExpenseDocuments[0].SummaryFields {
			if aws.ToString(field.Type.Text) == "TAX" {
				tax, _ = strconv.ParseFloat(aws.ToString(field.ValueDetection.Text), 64)
			}
			if aws.ToString(field.Type.Text) == "TOTAL" {
				total, _ = strconv.ParseFloat(aws.ToString(field.ValueDetection.Text), 64)
			}
			if total != 0 && tax != 0 {
				break
			}
		}

		cum_sum := 0.0
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

		matches := (total - tax - cum_sum) < 0.01

		response := ReceiptResponse{
			Items:   items,
			Total:   total,
			Tax:     tax,
			Matches: matches,
		}

		return c.JSON(response)
	})

	app.Get("/ws/:session", websocket.New(func(c *websocket.Conn) {
		sessionID := c.Params("session")
	
		client := &Client{Conn: c}
	
		// Add client to room
		roomsMu.Lock()
		rooms[sessionID] = append(rooms[sessionID], client)
		roomsMu.Unlock()
	
		defer func() {
			// Remove client when disconnected
			roomsMu.Lock()
			clients := rooms[sessionID]
			for i, cl := range clients {
				if cl == client {
					rooms[sessionID] = append(clients[:i], clients[i+1:]...)
					break
				}
			}
			roomsMu.Unlock()
			c.Close()
		}()
	
		// Listen for messages from this client
		for {
			_, msg, err := c.ReadMessage()
			if err != nil {
				break // client disconnected
			}
	

			roomsMu.Lock()
			for _, cl := range rooms[sessionID] {
				if cl != client {
					_ = cl.Conn.WriteMessage(websocket.TextMessage, msg)
				}
			}
			roomsMu.Unlock()
		}
	}))

	app.Listen(":8000")
}
