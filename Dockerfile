# Usa una imagen base de Node.js basada en Debian
FROM node:20-bullseye-slim

# Instala las dependencias necesarias, incluyendo Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    xdg-utils \
    wget \
    curl \
    --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Establece el directorio de trabajo
WORKDIR /app

# Copia el package.json y el package-lock.json para instalar las dependencias
COPY package*.json ./

# Instala las dependencias necesarias con la opción --legacy-peer-deps
RUN npm install --legacy-peer-deps

# Copia el resto de la aplicación
COPY . .

# Establece variables de entorno para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Exponer el puerto en el que tu aplicación se ejecutará
EXPOSE 7700

# Comando para ejecutar la aplicación
CMD ["node", "capture-chart.js"]
