const express = require("express");
const ws = require("ws");
const fs = require("fs");

// const { WebSocketServer } = require('ws');
// const { useServer } = require('graphql-ws/lib/use/ws');

const anchor = require("@project-serum/anchor");
const { PublicKey } = require("@solana/web3.js");

const {
  getPoolData,
  getStateData,
  depositCofirm,
  withdrawCofirm,
  LAMPORTS_PER_SOL,
  adminWallet
} = require("./utils/contractlink");
const {
  connectDatabase,
  withdrawFundtoDatabase,
  depositFundtoDatabase,
  getFund,
  getStatus,
  setStatus
} = require("./utils/dblink");
require("dotenv").config();

const app = express();
const http = require("http");
const server = http.createServer(
  // {
  //   // key: fs.readFileSync("/etc/letsencrypt/live/rejectrumble.com/privkey.pem"),
  //   // cert: fs.readFileSync("/etc/letsencrypt/live/rejectrumble.com/cert.pem"),
  //   key: fs.readFileSync("privkey1.pem"),
  //   cert: fs.readFileSync("cert1.pem"),
  // },
  app);
// const io = require('socket.io')(server, {cors: {origin: "*"}});

// const io = require("socket.io")(server, {
//   handlePreflightRequest: (req, res) => {
//       const headers = {
//           "Access-Control-Allow-Headers": "Content-Type, Authorization",
//           "Access-Control-Allow-Origin": req.headers.origin, //or the specific origin you want to give access to,
//           "Access-Control-Allow-Credentials": true
//       };
//       res.writeHead(200, headers);
//       res.end();
//   }
// });

// const io = require('socket.io')(server,{
//   cors: {
//     origin: "*",
//     methods: ["GET", "POST"],
//     credentials:true
//   }
// });

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const { time } = require("console");

const green_index = 0;
const blue_index = 1;
const both_index = 2;

const random_percent_high = 1;
const random_percent_middle = 3;
const random_percent_low = 6;

let treasury_data = [];
let betting_data = [];
let bet_working = false;
const timeout = 1000;
let time_index = 0;
let timevar;

let betting_result = {};

io.on("connection", (socket) => {
  console.log("user connected");
  // receive a message from the client
  socket.on("deposit_fund", async (...data) => {
    // console.log("data");
    let buffer;
    try {
      buffer = JSON.parse(data);
    } catch (err) {
      console.log(err);
      socket.emit("message", {
        ok: false,
        message: "Request message error",
        type: "deposit_fund",
      });
      return;
    }
    // const state = await getStateData(buffer?.wallet);
    // console.log("state", JSON.stringify(state))
    // if(!state) {
    //   console.log("deposit fund error")
    //   socket.emit("message", {"ok":false, "message":"get state error", "type": "deposit_fund"});
    //   return
    // }
    // // console.log("state", state)
    // if(state?.data?.status != 1 || state?.data?.amount != buffer?.amount) {
    //   console.log("deposit fund error")
    //   socket.emit("message", {"ok":false, "message":"Not deposited", "type": "deposit_fund"});
    //   return
    // }

    // console.log("input amount", buffer)

    const result = await depositCofirm(buffer?.wallet, buffer?.amount);

    // console.log("chain result", result);

    // const result = {ok: true, res: null};

    if (result.ok == false) {
      console.log("send failed message");
      socket.emit("message", {
        ...JSON.parse(JSON.stringify(result)),
        type: "deposit_fund",
      });
      return;
    }

    // const result = await depositCofirm(buffer?.wallet)
    const res = await depositFundtoDatabase(buffer?.wallet, buffer?.amount * process.env.TOKEN_RATE / LAMPORTS_PER_SOL);
    socket.emit("message", {
      ...JSON.parse(JSON.stringify(res)),
      type: "deposit_fund",
    });

    // console.log("database reuslt", res)
  });

  socket.on("betting", async (...data) => {
    // console.log("betting", JSON.parse(data));
    if (bet_working) {
      io.emit("message", { ok: false, message: "Betting now" });
      return;
    }
    let buffer;
    try {
      buffer = JSON.parse(data);
    } catch (err) {
      // console.log(err)
      socket.emit("message", {
        ok: false,
        message: "Request message error",
        type: "betting",
      });
      return;
    }
    const res = await betting(buffer?.wallet, buffer?.amount, buffer?.type);
    // console.log("betting", res);
    io.emit("message", {
      ...JSON.parse(JSON.stringify(res)),
      wallet: buffer?.wallet,
      color: buffer?.type,
      type: "betting",
    });
  });

  socket.on("get_fund", async (...data) => {
    let buffer;
    try {
      buffer = JSON.parse(data);
    } catch (err) {
      // console.log(err)
      socket.emit("message", {
        ok: false,
        message: "Request message error",
        type: "get_fund",
      });
      return;
    }
    const res = await getFund(buffer?.wallet);
    socket.emit("message", {
      ...JSON.parse(JSON.stringify(res)),
      type: "get_fund",
    });
  });

  socket.on("get_status", async () => {
    const res = get_current_status();
    socket.emit("message", {
      ...betting_data,
      time_index: res,
      type: "get_status",
    });
  });

  socket.on("set_state", async (...data) => {
    let buffer;
    try {
      buffer = JSON.parse(data);
    } catch (err) {
      console.log(err)
      socket.emit("message", {
        ok: false,
        message: "Request message error",
        type: "set_state",
      });
      return;
    }

    const res = await setStatus(buffer?.wallet);
    
    socket.emit("message", {
      ...JSON.parse(JSON.stringify(res)),
      type: "set_state",
    });
  });


  socket.on("get_state", async (...data) => {
    let buffer;
    try {
      buffer = JSON.parse(data);
    } catch (err) {
      console.log(err)
      socket.emit("message", {
        ok: false,
        message: "Request message error",
        type: "get_state",
      });
      return;
    }
    let res = null;
    if(buffer?.wallet == "admin") {
      res = await getStatus(adminWallet.publicKey.toBase58())
      socket.emit("message", {
        ...JSON.parse(JSON.stringify(res)),
        type: "get_state_admin",
      });
    } else {
      res = await getStatus(buffer?.wallet);
      socket.emit("message", {
        ...JSON.parse(JSON.stringify(res)),
        type: "get_state_owner",
      });
    }
  });

  socket.on("withdraw", async (...data) => {
    let buffer;
    try {
      buffer = JSON.parse(data);
    } catch (err) {
      // console.log(err)
      socket.emit("message", {
        ok: false,
        message: "Request message error",
        amount: 0,
        type: "withdraw",
      });
      return;
    }

    const state = await getStateData(buffer?.wallet);
    const fund = await getFund(buffer?.wallet);

    // console.log("fund", fund)
    if (state.data.status != 0 || buffer?.amount > fund.amount || buffer?.amount <= 0) {
      // console.log("withdraw fail emit");
      socket.emit("message", {
        ok: false,
        message: "Invalid status or amount",
        amount: 0,
        type: "withdraw",
      });
      return;
    }

    // console.log("withdraw confirm");

    const result = await withdrawCofirm(buffer?.wallet, buffer?.amount  * LAMPORTS_PER_SOL / process.env.TOKEN_RATE);
    // console.log("chain result", result)
    if (result.ok == false) {
      socket.emit("message", {
        ...JSON.parse(JSON.stringify(result)),
        type: "withdraw",
      });
      return;
    }
    const res = await withdrawFundtoDatabase(buffer?.wallet, buffer?.amount);
    // console.log("result", res, buffer?.amount);
    io.emit("message", {
      ...JSON.parse(JSON.stringify({...res, amount: buffer?.amount})),
      type: "withdraw",
    });
  });
});

const betting = async (wallet, amount, type) => {
  if (!wallet || !amount || !type) {
    return { ok: false, message: "Invalid request param" };
  }
  try {
    const fund = await getFund(wallet);

    if (!fund.amount) {
      return { ok: false, message: "wallet is invalid" };
    }
    if (fund.amount < amount) {
      return { ok: false, message: "Insufficent funds" };
    }

    if (betting_data.length >= 0) {
      const item = betting_data.filter((_m) => _m.wallet == wallet);
      if (item.length > 0)
        return { ok: false, message: "You have already bet" };
    }

    betting_data.push({
      wallet: wallet,
      amount: amount,
      type: type,
    });

    return { ok: true, amount: amount, message: "Bet successfuly" };
  } catch (error) {
    console.log("betting error", error);
    return { ok: false, amount: amount, message: "Betting Error" };
  }
};

const generate_randome = (win_index) => {
  // console.log("win index", win_index);
  let green = 0;
  let blue = 0;
  let res = "green";
  if (win_index == green_index) {
    blue = Math.floor(Math.random() * 1000) % 5;
    green = blue + 1 + (Math.floor(Math.random() * 1000) % (5 - blue));
  } else if (win_index == blue_index) {
    green = Math.floor(Math.random() * 1000) % 5;
    blue = green + 1 + (Math.floor(Math.random() * 1000) % (5 - green));
  } else {
    green = blue = Math.floor(Math.random() * 1000) % 6;
  }

  if (green > blue) {
    res = "green";
  } else if (green == blue) {
    res = "same";
  } else {
    res = "blue";
  }

  return { green: green + 1, blue: blue + 1, result: res };
  // console.log("selected number", green, blue);
};

const betGame = async () => {
  try {
    // let res = await getBettingInfo();

    // console.log("betting start", betting_data)

    // if(!res.data) {
    if (betting_data.length == 0) {
      const rand = Math.floor(Math.random() * 1000) % 3;
      const result = generate_randome(rand);
      return { ok: false, ...result, message: "No bet" };
    }

    const bet_amount = [];
    let win_index = green_index;

    // amount = res.data.filter(_m => _m.type == "green").reduce((a, b) => a + b?.amount, 0) * process.env.WIN_COLOR_MULTIPLE_NUMBER;
    // console.log(betting_data)
    const amount_green =
      betting_data
        .filter((_m) => _m.type == "green")
        .reduce((a, b) => a + b?.amount, 0) *
      process.env.WIN_COLOR_MULTIPLE_NUMBER;
    bet_amount.push({ index: green_index, amount: amount_green });

    // amount = res.data.filter(_m => _m.type == "blue").reduce((a, b) => a + b?.amount, 0) * process.env.WIN_COLOR_MULTIPLE_NUMBER;
    const amount_blue =
      betting_data
        .filter((_m) => _m.type == "blue")
        .reduce((a, b) => a + b?.amount, 0) *
      process.env.WIN_COLOR_MULTIPLE_NUMBER;
    bet_amount.push({ index: blue_index, amount: amount_blue });

    // amount = res.data.filter(_m => _m.type == "both").reduce((a, b) => a + b?.amount, 0) * process.env.WIN_BOTH_MULTIPLE_NUMBER;
    const amount_both =
      betting_data
        .filter((_m) => _m.type == "same")
        .reduce((a, b) => a + b?.amount, 0) *
      process.env.WIN_BOTH_MULTIPLE_NUMBER;
    bet_amount.push({ index: both_index, amount: amount_both });

    bet_amount.sort((a, b) => b.amount - a.amount);

    // console.log("bet amount", bet_amount);

    const rand = Math.floor(Math.random() * 1000) % 10;

    // console.log("rand num", rand)

    if (rand <= random_percent_high) {
      // console.log(bet_amount[0])
      win_index = bet_amount[0].index;
    } else if (rand > random_percent_high && rand <= random_percent_high + random_percent_middle) {
      // console.log(bet_amount[1])
      win_index = bet_amount[1].index;
    } else {
      // console.log(bet_amount[2])
      win_index = bet_amount[2].index;
    }

    let reward = 0;
    bet_amount.map((item, index) => {
      if(item.index == win_index) {
        if(item.index == both_index) {
          reward = reward - item.amount  + item.amount / process.env.WIN_BOTH_MULTIPLE_NUMBER;
        } else {
          reward = reward - item.amount + item.amount / process.env.WIN_COLOR_MULTIPLE_NUMBER;
        }
      } else {
        if(item.index == both_index) {
          reward = reward + item.amount / process.env.WIN_BOTH_MULTIPLE_NUMBER;
        } else {
          reward = reward + item.amount / process.env.WIN_COLOR_MULTIPLE_NUMBER;
        }
      }
    })

    // console.log("reward", reward, win_index);

    await depositFundtoDatabase(adminWallet.publicKey.toBase58(), reward);

    await Promise.all(betting_data.map(async (element) => {
    // betting_data.map(async (element) => {
      let win_flag = false;
      if (element.type == "green" && win_index == green_index) {
        await depositFundtoDatabase(
          element.wallet,
          element.amount * (process.env.WIN_COLOR_MULTIPLE_NUMBER - 1)
        );
        win_flag = true;
      } else if (element.type == "blue" && win_index == blue_index) {
        await depositFundtoDatabase(
          element.wallet,
          element.amount * (process.env.WIN_COLOR_MULTIPLE_NUMBER - 1)
        );
        win_flag = true;
      } else if (element.type == "same" && win_index == both_index) {
        await depositFundtoDatabase(
          element.wallet,
          element.amount * (process.env.WIN_BOTH_MULTIPLE_NUMBER - 1)
        );
        win_flag = true;
      }

      if (!win_flag)
        await withdrawFundtoDatabase(element.wallet, element.amount);

      // await removeBettingRecord(element.wallet);
      betting_data = betting_data.filter(e=> e.wallet != element.wallet);
    }));

    // console.log("betting after", betting_data)

    const result = generate_randome(win_index);

    return { ok: true, ...result, message: "Bet complete" };
  } catch (error) {
    console.log("bet game error", error);
    const rand = Math.floor(Math.random() * 1000) % 3;
    const result = generate_randome(rand);
    return { ok: false, ...result, message: "Betting Error" };
  }
};

const timeBetting = async () => {
  clearTimeout(timevar);
  if (time_index == 0) {
    io.emit("message", { type: "betting_start" });
  } else if (time_index == 20) {
    bet_working = true;
    betting_result = await betGame();
    io.emit("message", { type: "roll_start", ...betting_result });
  } else if (time_index == 21) {
    io.emit("message", { type: "roll_end", ...betting_result });
  } else if (time_index > 23) {
    bet_working = false;
    time_index = -1;
  }
  time_index++;
  timevar = setTimeout(timeBetting, timeout);
};

const get_current_status = () => {
  return time_index;
};

function main() {
  connectDatabase();
  timevar = setTimeout(timeBetting, timeout);
}

main();

app.get("/", (req, res) => {
  res.send("Welcome to CORS server 😁");
});
app.get("/cors", (req, res) => {
  res.send("This has CORS enabled 🎈");
});

server.listen(3000, () => {
  console.log("listening on *:3000");
});
