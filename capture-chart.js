const puppeteer = require("puppeteer");
const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs-extra");
const ejs = require("ejs");

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

    page.on("error", (err) => console.error(`Error in page: ${err.message}`));
    page.on("pageerror", (pageErr) =>
      console.error(`Page error: ${pageErr.message}`)
    );

    page.on("requestfailed", (request) => {
      console.error(
        `Request failed: ${request.url()} - ${request.failure().errorText}`
      );
    });

    await page.setViewport({
      width: parseInt(width, 10),
      height: parseInt(height, 10),
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });

    await page.waitForSelector("#chart", { timeout: 5000 });
    await page.waitForSelector("#miTabla", { timeout: 5000 });

    const dirPath = path.join(__dirname, "img-impreg", id);
    fs.mkdirSync(dirPath, { recursive: true });

    const screenshotPathChart = path.join(dirPath, `${id}.png`);
    const chartElement = await page.$("#chart");

    if (chartElement) {
      await chartElement.screenshot({ path: screenshotPathChart });
    } else {
      console.error(`Chart element not found for case ID: ${id}`);
      return res.status(500).send("Chart element not found");
    }

    const screenshotPathTable = path.join(dirPath, `${id}_table.png`);
    const tableElement = await page.$("#miTabla");

    if (tableElement) {
      await tableElement.screenshot({ path: screenshotPathTable });
    } else {
      console.error(`Table element not found for case ID: ${id}`);
      return res.status(500).send("Table element not found");
    }

    // Leer la plantilla HTML y rellenarla con los datos
    const templatePath = path.join(__dirname, "template.html");
    const logoPath = path.join(__dirname, "logo_completo_blanco.jpg");
    const htmlContent = await ejs.renderFile(templatePath, {
      path,
      id,
      ...req.query,
      logoPath,
      chartImagePath: `file://${screenshotPathChart}`,
      tableImagePath: `file://${screenshotPathTable}`,
    });

    // Guardar el HTML en un archivo temporal
    const htmlPath = path.join(dirPath, `${id}.html`);
    await fs.writeFile(htmlPath, htmlContent);

    // Generar el PDF a partir del HTML
    const pdfPath = path.join(dirPath, `${id}.pdf`);
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle2" });
    await page.pdf({ path: pdfPath, format: "A4", margin: { top: "50px" } });

    res.json({
      chartImageUrl: `${req.protocol}://${req.get(
        "host"
      )}/img-impreg/${id}/${id}.png`,
      tableImageUrl: `${req.protocol}://${req.get(
        "host"
      )}/img-impreg/${id}/${id}_table.png`,
      pdfUrl: `${req.protocol}://${req.get("host")}/img-impreg/${id}/${id}.pdf`,
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
