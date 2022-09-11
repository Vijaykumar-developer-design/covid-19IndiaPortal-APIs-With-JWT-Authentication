const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = express();
app.use(express.json());
let db = null;

const initializeDBAAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDBAAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 2

app.get("/states/", authenticateToken, async (request, response) => {
  const getQuery = `SELECT * FROM state;`;
  const statesDetails = await db.all(getQuery);

  response.send(
    statesDetails.map((each) => {
      return {
        stateId: each.state_id,
        stateName: each.state_name,
        population: each.population,
      };
    })
  );
});

//API 3
const details = (state) => {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  };
};
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getDetailsQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const state = await db.get(getDetailsQuery);

  response.send(details(state));
});

//API 4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
    VALUES(
        '${districtName}',
        '${stateId}',
        '${cases}',
        '${cured}',
        '${active}',
        '${deaths}'

    );`;
  await db.run(addQuery);
  response.send("District Successfully Added");
});

//API 5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDetailsQuery = `SELECT * FROM district WHERE district_id = ${districtId};`;
    const dist = await db.get(getDetailsQuery);
    response.send({
      districtId: dist.district_id,
      districtName: dist.district_name,
      stateId: dist.state_id,
      cases: dist.cases,
      cured: dist.cured,
      active: dist.active,
      deaths: dist.deaths,
    });
  }
);

// API 6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteDistQuery);
    response.send("District Removed");
  }
);

// API 7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDetails = `UPDATE district
     SET
      district_name = '${districtName}',
      state_id='${stateId}',
      cases = '${cases}',
      cured = '${cured}',
      active= '${active}',
      deaths = '${deaths}';`;
    await db.run(updateDetails);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getDetails = `SELECT SUM(cases),SUM(cured),SUM(active),SUM(deaths) FROM district WHERE state_id = ${stateId};`;
    const stats = await db.get(getDetails);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
module.exports = app;
