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
app.set("trust proxy", true);
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
  const { sex, location, score } = req.body;

  const query =
    "INSERT INTO person(sex,location,test_score) values($1,$2,$3) RETURNING id";

  try {
    const answer = await pool.query(query, [sex, location, score]);

    res.status(201).send(answer.rows);
  } catch (err) {
    console.log(err);
    res.status(404).send(err);
  }
});

app.get("/data", async (req, res) => {
  try {
    const query = "SELECT * FROM person";
    const result = await pool.query(query);

    if (!result.rows) return res.status(404).send("Нет данных");

    const columnHeaders = ["Пол", "Населенный пункт", "Итог теста"];
    const excelData = result.rows.map((person) => [
      person.sex,
      person.location,
      person.test_score,
    ]);
    excelData.unshift(columnHeaders);

    const workbook = new excelJs.Workbook();
    const worksheet = workbook.addWorksheet("Sheet 1");

    worksheet.addRows(excelData);

    const excelFilePath = path.join(__dirname, "output.xlsx");

    workbook.xlsx.writeFile(excelFilePath).then(() => {
      return res.download(excelFilePath, "output.xlsx", (err) => {
        fs.unlinkSync(excelFilePath);
      });
    });
  } catch (err) {
    console.log(err);
    return res.status(404).send(err);
  }
});

app.post("/auth", async (req, res) => {
  const { username, password } = req.body;

  const adminCredentials = {
    username: "admin",
    password: "admin",
  };

  if (
    username === adminCredentials.username &&
    password === adminCredentials.password
  ) {
    return res.status(200).json({ message: "Авторизация прошла успешно" });
  } else {
    return res.status(401).json({ message: "Неправильный логин или пароль" });
  }
});

app.get("/", async (req, res) => {
  try {
    await pool.query("SELECT increment_visit_count()");

    const result = await pool.query(
      "SELECT * FROM visit_counts WHERE day = CURRENT_DATE"
    );

    return res.json({ ...result.rows[0] });
  } catch (error) {
    console.error("Ошибка:", error);
    res.status(500).json({ error: "Произошла ошибка" });
  }
});

app.get("/visit_counts", async (req, res) => {
  const { period } = req.query;
  let query = "";

  switch (period) {
    case "week":
      query =
        "SELECT day, count FROM visit_counts WHERE day >= CURRENT_DATE - INTERVAL '1 week' ORDER BY day ASC";
      break;
    case "month":
      query =
        "SELECT DATE_TRUNC('month', day) AS month, SUM(count) AS count FROM visit_counts GROUP BY month ORDER BY month";
      break;
    default:
      query =
        "SELECT day as date, count FROM visit_counts WHERE day >= CURRENT_DATE - INTERVAL '1 week'";
      break;
  }

  try {
    const result = await pool.query(query);

    if (!result.rows) return res.status(400).json("Нет данных");

    return res.status(200).json(result.rows);
  } catch (err) {
    console.log(err);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
