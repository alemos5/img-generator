# Usa una imagen base de Node.js basada en Debian/Ubuntu
FROM node:20-slim

# Establece el directorio de trabajo
WORKDIR /app

# Instala las primeras dependencias necesarias
RUN apt-get update && apt-get install -y \
    apt-transport-https \
    ca-certificates \
    gnupg2 \
    wget \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Añade la clave pública para el repositorio de Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -

# Añade el repositorio de Google Chrome
RUN sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list'

# Instala las dependencias necesarias, incluyendo Google Chrome
RUN apt-get update && apt-get install -y \
    google-chrome-stable \
    fonts-liberation \
    libnss3 \
    xdg-utils \
    wget \
    curl \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /tmp/*

# Copia el package.json y el package-lock.json para instalar las dependencias
COPY package*.json ./

# Instala las dependencias necesarias con la opción --legacy-peer-deps
RUN npm install --legacy-peer-deps

# Copia el resto de la aplicación
COPY . .

# Establece variables de entorno para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Exponer el puerto en el que tu aplicación se ejecutará
EXPOSE 7700

# Comando para ejecutar la aplicación
CMD ["node", "capture-chart.js"]
