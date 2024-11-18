const fs = require("fs");
const { google } = require("googleapis");
const axios = require("axios");

//key.json не прикреплял
const KEYFILE = "key.json";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const loginUser = async (username) => {
  try {
    const loginResponse = await axios.post(
      "http://94.103.91.4:5000/auth/login",
      {
        username: username,
      }
    );

    const token = loginResponse.data.token;

    console.log("Наш токен: ", token);

    return token;
  } catch (error) {
    console.error(
      "Какая-то ошибка: ",
      error.response ? error.response.data : error.message
    );
  }
};

const fetchClients = async (token) => {
  let offset = 0;
  let clients = [];
  let hasMoreData = true;

  while (hasMoreData) {
    try {
      const response = await axios.get(
        `http://94.103.91.4:5000/clients?offset=${offset}`,
        {
          headers: {
            Authorization: token,
          },
        }
      );

      console.log("Фетчим данные с ручки");

      if (response.data && response.data.length > 0) {
        const data = response.data;
        clients = clients.concat(data);
        offset += 1000;

        const userIds = data.map((client) => client.id);
        const response1 = await axios.post(
          `http://94.103.91.4:5000/clients`,
          {
            userIds: userIds,
          },
          {
            headers: {
              Authorization: token,
            },
          }
        );

        const statuses = response1.data.reduce((acc, status) => {
          acc[status.id] = status;
          return acc;
        }, {});

        clients = clients.map((client) => {
          if (statuses[client.id]) {
            return { ...client, status: statuses[client.id].status };
          }
          return client;
        });
      } else {
        hasMoreData = false;
      }
    } catch (error) {
      console.error(
        "Ошибка при получении клиентов:",
        error.response ? error.response.data : error.message
      );
      hasMoreData = false;
    }
  }

  return clients;
};

async function accessSpreadsheet(clients) {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILE,
    scopes: SCOPES,
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const spreadsheetId = "12Bho2xmFCG8gxY7KuUH9lN-SrANolfcoDNzruYNouYU";
  const range = "Лист1!A1";

  console.log("Начал вставку");

  const values = [
    [
      "id",
      "firstName",
      "lastName",
      "gender",
      "address",
      "city",
      "phone",
      "email",
      "status",
    ],
    ...clients.map((client) => [
      client.id,
      client.firstName,
      client.lastName,
      client.gender,
      client.address,
      client.city,
      client.phone,
      client.email,
      client.status,
    ]),
  ];

  const resource = {
    values,
  };

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      resource,
    });
    console.log("Данные успешно вставлены в таблицу: ", response.data);
  } catch (error) {
    console.error("Ошибка: ", error);
  }
}

async function main() {
  const token = await loginUser("Slava");
  const clients = await fetchClients(token);
  await accessSpreadsheet(clients);
}

main();

//Можно было решить данную задачу намного более быстрым способом, чтобы не ждать пока он вставит сразу 100000 элементов, а допустим вставлять по 1000
//Но в условии такого не было ^_^
