const puppeteer = process.env.AWS_LAMBDA_FUNCTION_VERSION
  ? require("puppeteer-core")
  : require("puppeteer");
const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs-extra");
const chrome = process.env.AWS_LAMBDA_FUNCTION_VERSION
  ? require("chrome-aws-lambda")
  : null;

// Servir los directorios img-impreg de forma pública
app.use("/img-impreg", express.static(path.join(__dirname, "img-impreg")));

app.get("/", async (req, res) => {
  const { url, width, height, id } = req.query;

  if (!url || !width || !height || !id) {
    return res
      .status(400)
      .send("Missing required query parameters: url, width, height, id");
  }

  console.log(`Processing case ID: ${id}`);
  console.log(`Received URL: ${url}`);

  let browser = null;

  try {
    if (process.env.AWS_LAMBDA_FUNCTION_VERSION) {
      browser = await puppeteer.launch({
        args: chrome.args,
        executablePath: await chrome.executablePath,
        headless: chrome.headless,
      });
    } else {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    const page = await browser.newPage();

    await page.setViewport({
      width: parseInt(width, 10),
      height: parseInt(height, 10),
    });

    console.log(`Navigating to URL for case ID: ${id}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }); // Aumentado el tiempo de espera a 60 segundos

    // Esperar a que el gráfico y la tabla estén presentes en el DOM
    await page.waitForSelector("#chart");
    await page.waitForSelector("#miTabla");

    // Seleccionar el gráfico y tomar una captura de pantalla solo de ese elemento
    const screenshotPathChart = path.join(__dirname, "img-impreg", `${id}.png`);
    const chartElement = await page.$("#chart");

    // Crear el directorio si no existe
    fs.mkdirSync(path.dirname(screenshotPathChart), { recursive: true });

    if (chartElement) {
      await chartElement.screenshot({ path: screenshotPathChart });
      console.log(`Chart screenshot saved at: ${screenshotPathChart}`);
    } else {
      console.error(`Chart element not found for case ID: ${id}`);
      return res.status(500).send("Chart element not found");
    }

    // Seleccionar la tabla y tomar una captura de pantalla solo de ese elemento
    const screenshotPathTable = path.join(
      __dirname,
      "img-impreg",
      `${id}_table.png`
    );
    const tableElement = await page.$("#miTabla");

    if (tableElement) {
      await tableElement.screenshot({ path: screenshotPathTable });
      console.log(`Table screenshot saved at: ${screenshotPathTable}`);
    } else {
      console.error(`Table element not found for case ID: ${id}`);
      return res.status(500).send("Table element not found");
    }

    res.json({
      chartImageUrl: `${req.protocol}://${req.get(
        "host"
      )}/img-impreg/${id}.png`,
      tableImageUrl: `${req.protocol}://${req.get(
        "host"
      )}/img-impreg/${id}_table.png`,
    });
  } catch (error) {
    console.error(
      `Error capturing screenshot for case ID: ${id}`,
      error.message,
      error.stack
    );
    res.status(500).send("Error capturing screenshot: " + error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log(`Finished processing case ID: ${id}`);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
