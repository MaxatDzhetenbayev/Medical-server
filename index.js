const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const excelJs = require("exceljs");
const fs = require("fs");

const app = express();
const port = 3001;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

const pool = new Pool({
  user: "maksat",
  host: "dpg-cjfe12gcfp5c73abst0g-a.frankfurt-postgres.render.com",
  database: "medical",
  password: "sPYAexxEwESUiE5lWMzzGAa4cscRWwva",
  port: 5432,
  idleTimeoutMillis: 7200,
  ssl: true,
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.post("/upload", upload.single("image"), (req, res) => {
  res.json({ message: "Изображение успешно загружено" });
});

app.get("/api/translations/:key", async (req, res) => {
  const { lang, page } = req.query;
  const { key } = req.params;
  try {
    const query =
      "SELECT * FROM translations WHERE key = $1 and language = $2 and page = $3";
    const result = await pool.query(query, [key, lang, page]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching translations", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/add-translation", async (req, res) => {
  const { key, content, language, page } = req.body;
  console.log(key);

  try {
    await pool.query(
      "INSERT INTO translations (key, content, language, page) VALUES ($1, $2, $3, $4)",
      [key, content, language, page]
    );
    res.status(201).json({ message: "Translation added successfully!" });
  } catch (error) {
    console.error("Error adding translation:", error);
    res.status(500).json({ message: "Error adding translation" });
  }
});

app.post("/questionnaire", async (req, res) => {
  const { age, sex, region, city, score } = req.body;
  console.log(req.body);

  const query =
    "INSERT INTO person(age,sex,region,city,test_score) values($1,$2,$3,$4,$5) RETURNING id";

  try {
    const answer = await pool.query(query, [age, sex, region, city, score]);

    res.status(201).send(answer.rows);
  } catch (err) {
    console.log(err);
    res.status(404).send(err);
  }
});

app.get("/data", async (req, res) => {
  const client = await pool.connect();

  try {
    const query = "SELECT * FROM person";
    const result = await client.query(query);

    if (!result.rows) return res.status(404).send("Нет данных");

    const columnHeaders = ["Возраст", "Пол", "Регион", "Город", "Итог теста"];
    const excelData = result.rows.map((person) => [
      person.age,
      person.sex,
      person.region,
      person.city,
      person.test_score,
    ]);
    excelData.unshift(columnHeaders);

    const workbook = new excelJs.Workbook();
    const worksheet = workbook.addWorksheet("Sheet 1");

    worksheet.addRows(excelData);

    const excelFilePath = path.join(__dirname, "uploads", "output.xlsx");

    workbook.xlsx.writeFile(excelFilePath);

    return res.status(200).send("OK!");

  } catch (err) {
    console.log(err);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
