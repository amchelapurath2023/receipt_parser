package main

import "fmt"
import "github.com/gofiber/fiber/v2"
import "github.com/aws/aws-sdk-go-v2/service/textract"
import "github.com/aws/aws-sdk-go-v2/service/textract/types"
import "github.com/aws/aws-sdk-go-v2/config"
import "context"
import "bytes"
import "io"

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

		//fmt.Println(resp[1][])

		return c.SendStatus(fiber.StatusOK) 
	  })
	app.Listen(":8000")
}