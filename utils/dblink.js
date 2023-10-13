const config = require("../config");
const mongoose = require("mongoose");
const Treasury = require("../models/treasury");

const connectDatabase = async () => {
    try {
        mongoose.connect(config.database.url, {
            // 'mongodb://127.0.0.1:27017'            process.env.MONGO_URI
            useNewUrlParser: true,
            useUnifiedTopology: true,
        }).then(() => console.log("Mongoose Connected"));
    } catch(error) {
        console.log(error);

    }
}

const getFund = async (wallet) => {

    // console.log("wallet", wallet)
    if(!wallet) {
        return {ok: false, wallet: wallet, amount: 0}
    }

    try {
        const data = await Treasury.find({wallet: wallet});
        if(data.length > 0) {
            fund = data[0]?.amount
            return {ok: true, wallet: wallet, amount: fund}
        } else {
            return {ok: false, wallet: wallet, amount: 0}
        }
    } catch(error) {
        console.log("get fund error", error)
        return {ok: false, wallet: wallet, amount: 0}
    }
}

const getStatus = async (wallet) => {

    // console.log("wallet", wallet)
    if(!wallet) {
        return {ok: false, wallet: wallet, status: false}
    }

    try {
        const data = await Treasury.find({wallet: wallet});
        if(data.length > 0) {
            return {ok: true, wallet: wallet, status: data[0]?.status}
        } else {
            return {ok: false, wallet: wallet, status: false}
        }
    } catch(error) {
        console.log("get status error", error)
        return {ok: false, wallet: wallet, status: false}
    }
}

const setStatus = async (wallet) => {

    // console.log("wallet", wallet)
    if(!wallet) {
        return {ok: false, wallet: wallet}
    }

    try {
        res = await Treasury.updateOne({wallet: wallet}, { $set: {status: true}});
        if(res) {
            return {ok: true, wallet: wallet}
        } else {
            return {ok: false, wallet: wallet}
        }
    } catch(error) {
        console.log("set status error", error)
        return {ok: false, wallet: wallet}
    }
}

const withdrawFundtoDatabase = async (wallet, amount) => {
    if(!wallet || !amount) {
        return {ok: false, data: "withdraw error"}
    }

    try {
        const fund = await getFund(wallet)

        if(amount > fund.amount)  {
            return {ok: falsem, message: "Invalid amount"}
        }

        const res = await Treasury.updateOne({wallet: wallet}, { $set: {wallet: wallet, amount: fund.amount - amount}});
     
        if(res) {
            return {ok: true, message: "withdraw successfully"};
        } else {
            return {ok: false, message: "withdraw error"};
        }
    } catch (error) {
        console.log("deposit fund to database error", error)
        return {ok: false, data: "withdraw error"}
    }
}

const depositFundtoDatabase = async (wallet, amount) => {
    if(!wallet || !amount) {
        return {ok: false, message: "Deposit error"}
    }

    try {
        // const fund = await getFund(wallet);
        const fund = await getFund(wallet)

        let res = false;

        if(fund.ok == false) {
           res = await insertFundToDatabase(wallet, amount)
        } else {
           res = await Treasury.updateOne({wallet: wallet}, { $set: {wallet: wallet, amount: fund.amount + amount}});
        }
     
        if(res) {
            return {ok: true, message: "Deposit successfully"};
        } else {
            return {ok: false, message: "Deposit error"};
        }
    
    } catch (error) {
        console.log("withdraw fund to database error", error)
        return {ok: false, message: "Deposit error"}
    }
}

const insertFundToDatabase = async (wallet, amount) => {
    const data = new Treasury();
    data.wallet = wallet;
    data.amount = amount;
    const res = await data.save();
    return res;
}

module.exports = {
    connectDatabase,
    withdrawFundtoDatabase,
    depositFundtoDatabase,
    getFund,
    setStatus,
    getStatus
}
