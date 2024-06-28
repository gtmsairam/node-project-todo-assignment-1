const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const format = require("date-fns/format");
const isValid = require("date-fns/isValid");
const path = require("path");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "todoApplication.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const inValidRequest = (request, response, next) => {
  const { status, category, priority, dueDate } = request.body;
  const errorMessage = (error) => {
    response.status(400);
    response.send(`Invalid ${error}`);
  };
  let isAllPropertiesValid = [];
  const isStatusValid = () => {
    if (status !== "DONE" && status !== "IN PROGRESS" && status !== "TO DO") {
      errorMessage("Todo Status");
    } else {
      next();
    }
  };

  const isPriorityValid = () => {
    priority !== "HIGH" && priority !== "MEDIUM" && priority !== "LOW"
      ? errorMessage("Todo Priority")
      : next();
  };

  const isCategoryValid = () => {
    category !== "HOME" && category !== "WORK" && category !== "LEARNING"
      ? errorMessage("Todo Category")
      : next();
  };

  const isDateValid = () => {
    const date = isValid(new Date(dueDate)) ? next() : errorMessage("Due Date");
  };

  switch (true) {
    case status !== undefined:
      isStatusValid();
      break;
    case category !== undefined:
      isCategoryValid();
      break;
    case priority !== undefined:
      isPriorityValid();
      break;
    case dueDate !== undefined:
      isDateValid();
      break;
    default:
      next();
  }
};

const convertIntoCamelCase = (object) => ({
  id: object.id,
  todo: object.todo,
  priority: object.priority,
  status: object.status,
  category: object.category,
  dueDate: object.due_date,
});

const hasStatusProperty = (object) => {
  return object.status !== undefined;
};

const hasPriorityProperty = (object) => {
  return object.priority !== undefined;
};

const hasStatusAndPriorityProperty = (object) => {
  return object.status !== undefined && object.priority !== undefined;
};

const hasCategoryAndStatusProperty = (object) => {
  return object.category !== undefined && object.status !== undefined;
};

const hasCategoryProperty = (object) => {
  return object.category !== undefined;
};

const hasCategoryAndPriorityProperty = (object) => {
  return object.category !== undefined && object.priority !== undefined;
};

// update query parameters (API-1)
app.get("/todos/", async (request, response) => {
  let data = null;
  let dbQuery = "";
  let invalidQuery = "";
  const { search_q = "", status, priority, category } = request.query;
  switch (true) {
    case hasStatusAndPriorityProperty(request.query):
      invalidQuery = "Todo Status And Priority";
      dbQuery = `
             SELECT * FROM todo 
             WHERE todo LIKE '%${search_q}%' AND
             status = '${status}' AND 
             priority = '${priority}'
            `;
      break;
    case hasCategoryAndStatusProperty(request.query):
      invalidQuery = "Todo Category And Status";
      dbQuery = `
        SELECT *FROM todo WHERE 
        todo LIKE '%${search_q}%' AND
        status = '${status}' AND
        category = '${category}'
        `;
      break;
    case hasCategoryAndPriorityProperty(request.query):
      invalidQuery = "Todo Category And Priority";
      dbQuery = `
        SELECT *FROM todo WHERE 
        todo LIKE '%${search_q}%' AND
        (category = '${category}' AND
        priority = '${priority}')
        `;
      break;
    case hasCategoryProperty(request.query):
      invalidQuery = "Todo Category";
      dbQuery = `
        SELECT *FROM todo WHERE 
        todo LIKE '%${search_q}%' AND
        category = '${category}'
        `;
      break;
    case hasStatusProperty(request.query):
      invalidQuery = "Todo Status";
      dbQuery = `
             SELECT * FROM todo 
             WHERE todo LIKE '%${search_q}%' AND 
             status = '${status}'
            `;
      break;
    case hasPriorityProperty(request.query):
      invalidQuery = "Todo Priority";
      dbQuery = `
             SELECT * FROM todo 
             WHERE todo LIKE '%${search_q}%' AND 
             priority = '${priority}'
            `;
      break;
    default:
      invalidQuery = "Todo";
      dbQuery = `
          SELECT * FROM todo 
          WHERE todo LIKE '%${search_q}%'
          `;
  }
  data = await db.all(dbQuery);
  if (data.length === 0) {
    response.status(400);
    response.send(`Invalid ${invalidQuery}`);
  } else {
    response.send(data.map((eachItem) => convertIntoCamelCase(eachItem)));
  }
});

// get specific todo (API-2)
app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const dbQuery = `
    SELECT * FROM todo 
    WHERE id = ${todoId} 
    `;
  const data = await db.get(dbQuery);
  response.send(convertIntoCamelCase(data));
});

// get specific due date based details (API-3)
app.get("/agenda/", inValidRequest, async (request, response) => {
  const { date } = request.query;
  const isValidDate = isValid(new Date(date));
  if (isValidDate) {
    const formatDate = format(new Date(date), "yyyy-MM-dd");
    const dbQuery = `
     SELECT * FROM todo 
     WHERE due_date = '${formatDate}'
    `;
    const data = await db.all(dbQuery);
    if (data.length === 0) {
      response.send("No Results In This Date");
    } else {
      response.send(data.map((eachItem) => convertIntoCamelCase(eachItem)));
    }
  } else {
    response.status(400);
    response.send("Invalid Due Date");
  }
});

// create a new todo (API-4)
app.post("/todos/", inValidRequest, async (request, response) => {
  const { id, todo, status, priority, category, dueDate } = request.body;
  const dbQuery = `
    INSERT INTO 
     todo(id, todo, status, priority, category, due_date)
     VALUES
        (${id}, '${todo}', '${status}', '${priority}', '${category}', '${dueDate}') 
    `;
  await db.run(dbQuery);
  response.send("Todo Successfully Added");
});

// update  a specific todo (API-5)
app.put("/todos/:todoId/", inValidRequest, async (request, response) => {
  try {
    const { todoId } = request.params;
    let updateColumn = "";
    const requestBody = request.body;
    switch (true) {
      case requestBody.status !== undefined:
        updateColumn = "Status";
        break;
      case requestBody.category !== undefined:
        updateColumn = "Category";
        break;
      case requestBody.priority !== undefined:
        updateColumn = "Priority";
        break;
      case requestBody.todo !== undefined:
        updateColumn = "Todo";
        break;
      case requestBody.dueDate !== undefined:
        updateColumn = "Due Date";
        break;
    }
    const dbQuery = `
     SELECT * FROM todo 
     WHERE id = ${todoId}
    `;
    const previousTodo = await db.get(dbQuery);
    const {
      todo = previousTodo.todo,
      status = previousTodo.status,
      category = previousTodo.category,
      priority = previousTodo.priority,
      dueDate = previousTodo.due_date,
    } = request.body;
    const formatDueDate = format(new Date(dueDate), "yyyy-MM-dd");
    const updateQuery = `
   UPDATE todo 
   SET 
    todo = '${todo}',
    status = '${status}',
    category = '${category}',
    priority = '${priority}',
    due_date = '${formatDueDate}'
    WHERE 
      id = ${todoId}
  `;
    await db.run(updateQuery);
    response.send(`${updateColumn} Updated`);
  } catch (e) {
    console.log(e.message);
  }
});

// delete a todo (API-6)
app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const dbQuery = `
     DELETE FROM todo 
     WHERE id = ${todoId}
    `;
  await db.run(dbQuery);
  response.send("Todo Deleted");
});

module.exports = app;
