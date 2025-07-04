# Visualizador de Turnos de Fútbol con Google Sheets

Esta aplicación muestra los turnos disponibles para dos canchas de fútbol, obteniendo los datos desde una hoja de Google Sheets.

## Configuración de Google Sheets

1. Crea una nueva hoja de cálculo en Google Sheets
2. Configura las siguientes columnas:
   - `fecha` (formato YYYY-MM-DD, ejemplo: 2024-05-22)
   - `cancha` (valores: 1 o 2)
   - `horario` (ejemplo: 10:00, 11:00, etc.)
   - `disponible` (valores: si/no, true/false, o 1/0)

Ejemplo de estructura:

| fecha      | cancha | horario | disponible |
|------------|--------|---------|------------|
| 2024-05-22 | 1      | 10:00   | si         |
| 2024-05-22 | 1      | 11:00   | si         |
| 2024-05-22 | 1      | 12:00   | no         |
| 2024-05-22 | 2      | 10:00   | si         |
| 2024-05-22 | 2      | 11:00   | no         |

## Configuración de credenciales

Para conectar con Google Sheets, necesitas configurar las siguientes variables de entorno:

1. `GOOGLE_SHEETS_ID`: El ID de tu hoja de cálculo (se encuentra en la URL)
2. `GOOGLE_SERVICE_ACCOUNT_EMAIL`: El email de tu cuenta de servicio de Google
3. `GOOGLE_PRIVATE_KEY`: La clave privada de tu cuenta de servicio

### Pasos para obtener las credenciales:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto
3. Habilita la API de Google Sheets
4. Crea una cuenta de servicio
5. Genera una clave JSON para la cuenta de servicio
6. Comparte tu hoja de cálculo con el email de la cuenta de servicio

## Instalación

1. Clona este repositorio
2. Instala las dependencias con `npm install`
3. Configura las variables de entorno en un archivo `.env.local`
4. Ejecuta la aplicación con `npm run dev`

## Personalización

Puedes personalizar la aplicación modificando los archivos en la carpeta `app` y `lib`.
