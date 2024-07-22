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
const PDFDocument = require("pdfkit");

// Servir los directorios img-impreg y pdf-impreg de forma pública
app.use("/img-impreg", express.static(path.join(__dirname, "img-impreg")));
app.use("/pdf-impreg", express.static(path.join(__dirname, "pdf-impreg")));

app.get("/", async (req, res) => {
  const { url, width, height, id } = req.query;

  if (!url || !width || !height || !id) {
    return res
      .status(400)
      .send("Missing required query parameters: url, width, height, id");
  }

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

    await page.goto(url, { waitUntil: "networkidle2" });

    await page.evaluate(() => {
      const chartElement = document.querySelector("#chart");
      if (chartElement) {
        chartElement.style.width = "100%";
        chartElement.style.height = "100vh";
        chartElement.style.display = "flex";
        chartElement.style.justifyContent = "center";
        chartElement.style.alignItems = "center";
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const screenshotPath = path.join(__dirname, "img-impreg", `${id}.png`);

    // Crear el directorio si no existe
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

    await page.screenshot({ path: screenshotPath, fullPage: true });

    if (fs.existsSync(screenshotPath)) {
      const pdfPath = path.join(__dirname, "pdf-impreg", `${id}.pdf`);
      fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

      // Crear un PDF y almacenarlo
      const doc = new PDFDocument({ autoFirstPage: false });
      const pdfStream = fs.createWriteStream(pdfPath);

      doc.pipe(pdfStream);

      const margin = 5; // Ajustar el margen para agrandar la imagen
      const pageWidth = 595.28; // A4 width in points
      const pageHeight = 841.89; // A4 height in points

      // Calculate the aspect ratio
      const aspectRatio = parseInt(width, 10) / parseInt(height, 10);

      // Calculate image dimensions maintaining aspect ratio
      let imgWidth = pageWidth - 2 * margin;
      let imgHeight = imgWidth / aspectRatio;

      if (imgHeight > pageHeight - 2 * margin) {
        imgHeight = pageHeight - 2 * margin;
        imgWidth = imgHeight * aspectRatio;
      }

      // Adjust to make image taller
      imgHeight *= 2.0;
      if (imgHeight > pageHeight - 2 * margin) {
        imgHeight = pageHeight - 2 * margin;
        imgWidth = imgHeight * aspectRatio;
      }

      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;

      doc
        .addPage({ size: "A4", layout: "portrait" })
        .image(screenshotPath, x, y, { width: imgWidth, height: imgHeight });
      doc.end();

      pdfStream.on("finish", () => {
        res.json({
          imageUrl: `${req.protocol}://${req.get("host")}/img-impreg/${id}.png`,
          pdfUrl: `${req.protocol}://${req.get("host")}/pdf-impreg/${id}.pdf`,
        });
      });

      console.log("Screenshot and PDF generated for:", id);
    } else {
      console.error("Screenshot not found at:", screenshotPath);
      res.status(500).send("Error capturing screenshot");
    }
  } catch (error) {
    console.error("Error capturing screenshot:", error.message, error.stack);
    res.status(500).send("Error capturing screenshot: " + error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
