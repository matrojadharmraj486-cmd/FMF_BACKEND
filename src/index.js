import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/database.js";
import { getEmailConfigSummary } from "./utils/email.js";
import { logger } from "./utils/logger.js";

const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      logger.info("Server started", {
        port: PORT,
        nodeEnv: process.env.NODE_ENV || null,
        emailConfig: getEmailConfigSummary()
      });
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
