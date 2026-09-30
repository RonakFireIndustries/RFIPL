// mysql connection
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const connectDB = async () => {
    try {
        const connection = await pool.getConnection();
        console.log("Database connected successfully");
        connection.release();
        return pool;
    } catch (error) {
        console.error("Error connecting to database:", error);
        throw error;
    }
};

export { pool };
export default connectDB;