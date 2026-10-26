# Book CRUD API

A beginner-friendly RESTful API for managing books, built with **Node.js**, **Express.js**, **Sequelize ORM** and **PostgreSQL**, and tested with **Postman**.

Each book has: `id` (auto-increment), `title` (required), `author` (required), `createdAt`, `updatedAt`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/books` | Create a new book |
| GET | `/api/books` | Retrieve all books |
| GET | `/api/books/:id` | Retrieve one book |
| PUT | `/api/books/:id` | Update an existing book |
| DELETE | `/api/books/:id` | Delete a book |

---

## 1. Prerequisites

- Node.js 18 or newer (`node -v`)
- PostgreSQL installed and running locally (with pgAdmin or `psql`)
- Postman

## 2. Installation

```bash
cd book-crud-api
npm install
```

This installs everything listed in `package.json` and creates `package-lock.json` and `node_modules/`.

If you were starting from an empty folder, the equivalent commands are:

```bash
npm init -y
npm install express@4 sequelize pg pg-hstore dotenv
npm install --save-dev nodemon
```

## 3. Create the database

The table is created automatically by Sequelize, but the **database itself** must exist first.

**Option A: pgAdmin**
1. Open pgAdmin and connect to your server.
2. Right-click **Databases** > **Create** > **Database...**
3. Name it `book_crud_db` and click **Save**.

**Option B: psql command line**
```bash
psql -U postgres
```
```sql
CREATE DATABASE book_crud_db;
\q
```
(Use your own PostgreSQL username if it is not `postgres`.)

## 4. Configure environment variables

Copy the example file and fill in your real values:

```bash
# macOS / Linux / Git Bash
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Edit `.env`:

```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=book_crud_db
DB_USER=postgres
DB_PASSWORD=your_real_password
```

`.env` is listed in `.gitignore`. Never submit or commit it.

## 5. Start the server

```bash
npm run dev     # development, restarts automatically on changes (nodemon)
npm start       # normal start
```

Expected console output:

```
Connected to PostgreSQL.
Database synchronized ("books" table is ready).
Server running at http://localhost:3000
```

The server only starts listening after the database connection succeeds. If PostgreSQL is unreachable or the password is wrong, it prints the error and exits.

---

## 6. Postman testing

Set the header `Content-Type: application/json` for requests with a body (in Postman choose **Body > raw > JSON**).

### Test 1: POST, create a book
- **POST** `http://localhost:3000/api/books`
- Body:
```json
{
  "title": "Clean Code",
  "author": "Robert C. Martin"
}
```
- Expected status: **201 Created**
```json
{
  "message": "Book created successfully",
  "data": {
    "id": 1,
    "title": "Clean Code",
    "author": "Robert C. Martin",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```
(Timestamps will show your actual date and time.)

### Test 2: GET, retrieve the inserted book
- **GET** `http://localhost:3000/api/books/1`
- Expected status: **200 OK**
```json
{
  "message": "Book retrieved successfully",
  "data": { "id": 1, "title": "Clean Code", "author": "Robert C. Martin", "createdAt": "...", "updatedAt": "..." }
}
```
- Also try **GET** `http://localhost:3000/api/books` (200 OK):
```json
{
  "message": "Books retrieved successfully",
  "count": 1,
  "data": [ { "id": 1, "title": "Clean Code", "author": "Robert C. Martin", "createdAt": "...", "updatedAt": "..." } ]
}
```

### Test 3: PUT, update the book
- **PUT** `http://localhost:3000/api/books/1`
- Body (you may send `title`, `author`, or both):
```json
{
  "title": "Clean Code: A Handbook of Agile Software Craftsmanship"
}
```
- Expected status: **200 OK**
```json
{
  "message": "Book updated successfully",
  "data": { "id": 1, "title": "Clean Code: A Handbook of Agile Software Craftsmanship", "author": "Robert C. Martin", "createdAt": "...", "updatedAt": "..." }
}
```

### Test 4: GET, prove the update persisted
- **GET** `http://localhost:3000/api/books/1`
- Expected status: **200 OK**, and `title` shows the new value.

### Test 5: DELETE, remove the book
- **DELETE** `http://localhost:3000/api/books/1`
- Expected status: **200 OK**
```json
{
  "message": "Book deleted successfully",
  "data": { "id": 1, "title": "Clean Code: A Handbook of Agile Software Craftsmanship", "author": "Robert C. Martin", "createdAt": "...", "updatedAt": "..." }
}
```

### Test 6: GET, prove the book is gone
- **GET** `http://localhost:3000/api/books/1`
- Expected status: **404 Not Found**
```json
{ "message": "Book with ID 1 not found" }
```
- **GET** `http://localhost:3000/api/books` returns `"count": 0` and `"data": []`.

### Test 7: Negative tests

| # | Request | Expected status | Expected JSON |
|---|---|---|---|
| a | POST `/api/books` body `{ "title": "Only Title" }` | 400 | `{"message":"Validation failed","errors":["author is required and must be a non-empty string"]}` |
| b | POST `/api/books` body `{}` | 400 | `{"message":"Validation failed","errors":["title is required and must be a non-empty string","author is required and must be a non-empty string"]}` |
| c | POST `/api/books` body `{ "title": "   ", "author": "X" }` | 400 | `{"message":"Validation failed","errors":["title is required and must be a non-empty string"]}` |
| d | GET `/api/books/999` | 404 | `{"message":"Book with ID 999 not found"}` |
| e | GET `/api/books/abc` | 400 | `{"message":"Invalid book ID. It must be a positive whole number"}` |
| f | GET `/api/books/-5` | 400 | same message as (e) |
| g | PUT `/api/books/999` body `{ "title": "New" }` | 404 | `{"message":"Book with ID 999 not found"}` |
| h | PUT `/api/books/1` body `{}` | 400 | `{"message":"Validation failed","errors":["Provide at least one of: title, author"]}` |
| i | DELETE `/api/books/999` | 404 | `{"message":"Book with ID 999 not found"}` |
| j | DELETE `/api/books/abc` | 400 | same message as (e) |
| k | POST with broken JSON such as `{ "title": ` | 400 | `{"message":"Invalid JSON in request body"}` |

> Tests d, g, h and i need a book to exist or not exist as described. Run them after the delete test, when ID 1 is gone, or use any ID that does not exist. For test h, create a new book first and use its ID.

---

## 7. Verify directly in PostgreSQL

Open pgAdmin (Query Tool on `book_crud_db`) or run:

```bash
psql -U postgres -d book_crud_db
```

Check the table exists:
```sql
\dt                -- psql only: lists tables, you should see "books"
\d books           -- psql only: shows columns
```

| Step | After this Postman action | Run this SQL | What you should see |
|---|---|---|---|
| View all books | any time | `SELECT * FROM books ORDER BY id;` | all rows |
| Confirm insert | POST | `SELECT * FROM books WHERE id = 1;` | the row with title "Clean Code" |
| Confirm update | PUT | `SELECT id, title, author, "updatedAt" FROM books WHERE id = 1;` | new title, newer `updatedAt` |
| Confirm delete | DELETE | `SELECT * FROM books WHERE id = 1;` | 0 rows |
| Row count | any time | `SELECT COUNT(*) FROM books;` | matches the API's `count` |

Note: `"createdAt"` and `"updatedAt"` need double quotes in SQL because Sequelize creates them with capital letters.

The API and your SQL queries use the **same database** as long as `DB_NAME` in `.env` is `book_crud_db` and you inspect that database in pgAdmin/psql.

---

## 8. How the project works (for your class demo)

### Project structure and what each file does

```
book-crud-api/
├── server.js                         Entry point: loads .env, connects to DB, then starts Express
├── src/
│   ├── app.js                        Creates the Express app, JSON parsing, routes, error handling
│   ├── config/database.js            Creates the Sequelize connection from environment variables
│   ├── models/Book.js                Defines the books table (columns, types, rules)
│   ├── routes/bookRoutes.js          Maps HTTP method + URL to a controller function
│   └── controllers/bookController.js Validates input, talks to the model, sends JSON responses
├── .env.example                      Template of settings (placeholders only)
├── .gitignore                        Keeps node_modules and .env out of Git and the ZIP
├── package.json / package-lock.json  Dependencies and npm scripts
└── README.md                         This guide
```

- **server.js**: needed because something must start everything in the right order: load `.env`, check PostgreSQL works (`authenticate`), create the table if missing (`sync`), and only then call `app.listen`. It imports `app.js` and `database.js`, and imports `Book.js` so Sequelize knows the model exists before `sync`.
- **src/app.js**: builds the Express app. `express.json()` turns the request body into `req.body`. It mounts the router at `/api/books`, so a route `'/'` in the router becomes `/api/books`, and `'/:id'` becomes `/api/books/:id`. It also returns JSON for unknown URLs and malformed JSON.
- **src/config/database.js**: needed so connection settings live in one place and come from `process.env`, never from hardcoded passwords. Everything that talks to the database imports this one `sequelize` object.
- **src/models/Book.js**: needed because Sequelize must know what a "book" is. `sequelize.define` describes columns, `allowNull: false` makes `title` and `author` required, and `timestamps: true` makes Sequelize fill `createdAt` and `updatedAt` automatically. It uses the connection from `database.js` and is used by the controller.
- **src/routes/bookRoutes.js**: needed to keep URL definitions separate from logic. It has no database code; it just hands each request to the right controller function.
- **src/controllers/bookController.js**: needed because this is where the real work happens: check the ID and body, call the model (`create`, `findAll`, `findByPk`, `update`, `destroy`), and send the right status code and JSON.

### How Sequelize talks to PostgreSQL

1. `database.js` creates a Sequelize instance with `dialect: 'postgres'`. Sequelize uses the `pg` package (the PostgreSQL driver) to open the connection using host, port, database, username and password.
2. When the controller calls `Book.create({...})`, Sequelize translates it into SQL (`INSERT INTO "books" ...`), sends it through `pg`, and turns the returned row back into a JavaScript object.
3. `Book.findAll()` becomes `SELECT ... FROM "books"`, `findByPk(1)` becomes `SELECT ... WHERE "id" = 1`, `book.update()` becomes `UPDATE`, and `book.destroy()` becomes `DELETE`.
4. `sequelize.sync()` runs `CREATE TABLE IF NOT EXISTS "books" (...)` at startup. To see the generated SQL, set `logging: console.log` in `database.js`.

### Life of one request: `POST /api/books`

```
Postman
  -> Express server (server.js started it, app.js received it)
  -> express.json() parses the body into req.body
  -> app.use('/api/books', bookRoutes)         (app.js)
  -> router.post('/')                          (bookRoutes.js)
  -> createBook(req, res)                      (bookController.js)
       validate title/author -> 400 if invalid
  -> Book.create({ title, author })            (Book.js model)
  -> Sequelize builds INSERT SQL, sends via pg (database.js connection)
  -> PostgreSQL stores the row in "books"
  <- row comes back to the controller
  <- res.status(201).json({...})
  <- Postman shows the response
```

### Status codes used

| Code | Meaning | Used when |
|---|---|---|
| 200 | OK | successful GET, PUT, DELETE |
| 201 | Created | successful POST |
| 400 | Bad Request | missing/invalid fields, invalid ID, malformed JSON |
| 404 | Not Found | no book with that ID, or unknown URL |
| 500 | Internal Server Error | unexpected error (for example, the database went down) |

---

## 9. Screenshot checklist

**Postman** (show the URL, method, body, status code and response in each):
- [ ] POST create book (201)
- [ ] GET all books (200)
- [ ] GET one book by ID (200)
- [ ] PUT update book (200)
- [ ] GET same book again showing updated value (200)
- [ ] DELETE book (200)
- [ ] GET deleted book (404)
- [ ] Negative test: missing field (400)
- [ ] Negative test: nonexistent ID (404)
- [ ] Negative test: invalid ID such as `abc` (400)

**Terminal**:
- [ ] Server started with "Connected to PostgreSQL" and "Server running" messages

**PostgreSQL / pgAdmin**:
- [ ] `book_crud_db` database and the `books` table in the tree or `\dt`
- [ ] Table structure (`\d books` or the Columns view)
- [ ] `SELECT * FROM books;` after POST (new row visible)
- [ ] `SELECT * FROM books;` after PUT (updated value visible)
- [ ] `SELECT * FROM books;` after DELETE (row gone)

## 10. Prepare the submission ZIP

Required name: `LASTNAME_FIRSTNAME_BookCRUD.zip` (for example `DELACRUZ_JUAN_BookCRUD.zip`).

Include: `src/`, `server.js`, `package.json`, `package-lock.json`, `README.md`, `.env.example`, `.gitignore`.
Exclude: `node_modules/` and `.env`.

**Windows PowerShell** (run inside the `book-crud-api` folder):
```powershell
Compress-Archive -Path src, server.js, package.json, package-lock.json, README.md, .env.example, .gitignore -DestinationPath LASTNAME_FIRSTNAME_BookCRUD.zip
```

**macOS / Linux** (run inside the `book-crud-api` folder):
```bash
zip -r LASTNAME_FIRSTNAME_BookCRUD.zip src server.js package.json package-lock.json README.md .env.example .gitignore
```

Before submitting, open the ZIP and confirm there is no `node_modules` folder and no `.env` file. A grader can restore everything with `npm install`.

## 11. Quick demo order

1. Make sure PostgreSQL is running and `book_crud_db` exists.
2. `npm install` (first time only), then `npm run dev`.
3. In pgAdmin, run `SELECT * FROM books;` (empty).
4. Postman: POST > then SQL SELECT > GET > PUT > SQL SELECT > GET > DELETE > SQL SELECT > GET (404).
5. Show negative tests.

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `Missing environment variables` | `.env` file missing or in the wrong folder; it must sit next to `server.js` |
| `password authentication failed` | wrong `DB_USER` or `DB_PASSWORD` in `.env` |
| `database "book_crud_db" does not exist` | create it first (section 3) |
| `ECONNREFUSED` | PostgreSQL is not running, or `DB_HOST`/`DB_PORT` are wrong |
| `EADDRINUSE` | port 3000 is in use; change `PORT` in `.env` |
