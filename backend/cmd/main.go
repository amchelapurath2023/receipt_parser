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
	"github.com/redis/go-redis/v9"
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
	rooms   = make(map[string][]*Client)
	roomsMu sync.Mutex
	rdb     *redis.Client
)

const sessionTTL = 30 * 24 * time.Hour // 1 month expiration

func sessionKey(sessionID string) string {
	return "session:" + sessionID
}

func getSessionState(ctx context.Context, sessionID string) ([]byte, error) {
	data, err := rdb.Get(ctx, sessionKey(sessionID)).Bytes()
	if err == redis.Nil {
		return nil, nil
	}
	return data, err
}

func setSessionState(ctx context.Context, sessionID string, data []byte) error {
	return rdb.Set(ctx, sessionKey(sessionID), data, sessionTTL).Err()
}

func clearSessionState(ctx context.Context, sessionID string) error {
	return rdb.Del(ctx, sessionKey(sessionID)).Err()
}

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
func broadcastToRoom(sessionID string, mt int, msg []byte, exclude *Client) {
	roomsMu.Lock()
	clients := make([]*Client, len(rooms[sessionID]))
	copy(clients, rooms[sessionID])
	roomsMu.Unlock()

	for _, cl := range clients {
		if cl != exclude {
			_ = cl.Conn.WriteMessage(mt, msg)
		}
	}
}

func isCouponCode(s string) bool {
	if s[0] == '/' {
		s = s[1:]
	}
	_, err := strconv.ParseFloat(s, 64)
	return err == nil
}

func initRedis() *redis.Client {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Failed to parse REDIS_URL: %v", err)
	}
	client := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	log.Println("Connected to Redis")
	return client
}

func main() {
	rdb = initRedis()
	defer rdb.Close()
	app := fiber.New()
	code := fiber.StatusInternalServerError

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
		AllowMethods: "GET,POST,DELETE,OPTIONS",
	}))

	app.Use(limiter.New(limiter.Config{
		Max:        1000,
		Expiration: 1 * time.Minute,
	}))

	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	app.Post("/upload", func(c *fiber.Ctx) error {

		sessionID := c.Query("session")
		if sessionID == "" {
			return c.Status(fiber.StatusBadRequest).SendString("session query param required")
		}

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
						if len(fields) > 0 {
							clean := fields[0]
							clean = strings.TrimSuffix(clean, "-")
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

		stateJSON, err := json.Marshal(response)
		if err != nil {
			log.Printf("JSON marshal error: %v", err)
			return c.Status(code).SendString("Failed to serialize response")
		}
		if err := setSessionState(ctx, sessionID, stateJSON); err != nil {
			log.Printf("Redis set error: %v", err)
		}
		broadcastToRoom(sessionID, websocket.TextMessage, stateJSON, nil)

		return c.JSON(response)
	})

	// GET session state
	app.Get("/session/:session", func(c *fiber.Ctx) error {
		sessionID := c.Params("session")
		data, err := getSessionState(context.Background(), sessionID)
		if err != nil {
			return c.Status(code).SendString("Failed to retrieve session")
		}
		if data == nil {
			return c.Status(fiber.StatusNotFound).SendString("No session found")
		}
		c.Set("Content-Type", "application/json")
		return c.Send(data)
	})

	// DELETE (reset) session
	app.Delete("/session/:session", func(c *fiber.Ctx) error {
		sessionID := c.Params("session")
		if err := clearSessionState(context.Background(), sessionID); err != nil {
			return c.Status(code).SendString("Failed to clear session")
		}
		cleared, _ := json.Marshal(map[string]string{"type": "cleared"})
		broadcastToRoom(sessionID, websocket.TextMessage, cleared, nil)
		return c.SendString("session cleared")
	})

	app.Get("/ws/:session", websocket.New(func(c *websocket.Conn) {
		sessionID := c.Params("session")
		client := &Client{Conn: c}

		roomsMu.Lock()
		rooms[sessionID] = append(rooms[sessionID], client)

		// Send current state to new client

		roomsMu.Unlock()
		if state, err := getSessionState(context.Background(), sessionID); err == nil && state != nil {
			_ = c.WriteMessage(websocket.TextMessage, state)
		}

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

			_ = setSessionState(context.Background(), sessionID, msg)
			broadcastToRoom(sessionID, mt, msg, client)
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
