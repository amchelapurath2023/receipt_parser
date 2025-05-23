package main

import "github.com/gofiber/fiber/v2"
import "github.com/aws/aws-sdk-go-v2/service/textract"
import "github.com/aws/aws-sdk-go-v2/service/textract/types"
import "github.com/aws/aws-sdk-go-v2/config"
import "github.com/aws/aws-sdk-go-v2/aws"
import "context"
import "bytes"
import "io"
import "strings"
import "strconv"
import "fmt"

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

func main(){
	app := fiber.New()
	code := fiber.StatusInternalServerError

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
			Document: &types.Document {
			  Bytes: buf.Bytes(),
			},
		})
		if err != nil {
			return c.Status(code).SendString("File couldn't be parsed")
		}
		
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
			for _, field := range lineItem.LineItemExpenseFields{
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
		
		fmt.Println("cumulative price calculate:", cum_sum)
		matches := (total - tax - cum_sum) < 0.01

		response := ReceiptResponse {
			Items:    items,
			Total: 	  total,
			Tax:      tax,
			Matches: matches,
		}
		
		return c.JSON(response)
	  })
	app.Listen(":8000")
}