import dotenv from "dotenv";
import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";

dotenv.config(); // Carga las variables de entorno desde el .env

// Verifica que todas las variables estén definidas
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno: ${name}`);
  return value;
}

// Inicializa la conexión con Google Sheets usando service account vía variables
export async function getGoogleSheet(): Promise<GoogleSpreadsheet> {
  const clientEmail = getEnvVar("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getEnvVar("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const spreadsheetId = getEnvVar("GOOGLE_SHEETS_ID");

  const auth = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const doc = new GoogleSpreadsheet(spreadsheetId, auth);
  await doc.loadInfo();
  return doc;
}
