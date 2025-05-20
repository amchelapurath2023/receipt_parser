package main

import "github.com/gofiber/fiber/v2"
import "fmt"

func main(){
	app := fiber.New()

	app.Get("/", func(c *fiber.Ctx) error {
		return c.SendString("Hello Anshul!")
	})


	app.Post("/upload", func(c *fiber.Ctx) error {
		file, _ := c.FormFile("receipt")
		c.SaveFile(file, fmt.Sprintf("./%s", file.Filename))
		return c.SendStatus(fiber.StatusOK) 
		//return c.SaveFile(file, fmt.Sprintf("./%s", file.Filename))
	  })
	app.Listen(":8000")
}