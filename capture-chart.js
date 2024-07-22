const puppeteer = require("puppeteer");
const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs-extra");

const PUPPETEER_EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || null;

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
    browser = await puppeteer.launch({
      headless: true,
      executablePath: PUPPETEER_EXECUTABLE_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--ignore-certificate-errors",
        "--disable-software-rasterizer",
      ],
    });

    const page = await browser.newPage();

    page.on("console", (consoleObj) => console.log(consoleObj.text()));
    page.on("error", (err) => console.error(`Error in page: ${err.message}`));
    page.on("pageerror", (pageErr) =>
      console.error(`Page error: ${pageErr.message}`)
    );

    await page.setViewport({
      width: parseInt(width, 10),
      height: parseInt(height, 10),
    });

    console.log(`Navigating to URL for case ID: ${id}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });

    console.log("Waiting for #chart and #miTabla selectors");
    await page.waitForSelector("#chart", { timeout: 5000 });
    await page.waitForSelector("#miTabla", { timeout: 5000 });

    const screenshotPathChart = path.join(__dirname, "img-impreg", `${id}.png`);
    const chartElement = await page.$("#chart");

    fs.mkdirSync(path.dirname(screenshotPathChart), { recursive: true });

    if (chartElement) {
      await chartElement.screenshot({ path: screenshotPathChart });
      console.log(`Chart screenshot saved at: ${screenshotPathChart}`);
    } else {
      console.error(`Chart element not found for case ID: ${id}`);
      return res.status(500).send("Chart element not found");
    }

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

app.listen(7700, () => {
  console.log("Server is running on port 7700");
});
