# Usa una imagen base de Node.js
FROM node:20-alpine3.17

# Establece el directorio de trabajo
WORKDIR /app

# Copia el package.json y el package-lock.json para instalar las dependencias
COPY package*.json ./

# Instala las dependencias necesarias con la opción --legacy-peer-deps
RUN npm install --legacy-peer-deps

# Copia el resto de la aplicación
COPY . .

# Exponer el puerto en el que tu aplicación se ejecutará
EXPOSE 7700

# Comando para ejecutar la aplicación
CMD ["node", "capture-chart.js"]
