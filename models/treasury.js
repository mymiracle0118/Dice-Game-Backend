const { Boolean } = require("buffer-layout");
const mongoose = require("mongoose");

const treasurySchema = mongoose.Schema({
    wallet: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        default: 0,
    },
    status: {
        type: Boolean,
        default: false,
    },
});

const Treasury = mongoose.model("treasury", treasurySchema);
module.exports = Treasury;
