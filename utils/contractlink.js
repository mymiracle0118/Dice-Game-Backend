const { Data } = require("@metaplex-foundation/mpl-core/dist/src/utils/borsh");
const anchor = require("@project-serum/anchor");
const { hash } = require("@project-serum/anchor/dist/cjs/utils/sha256");
const splToken = require("@solana/spl-token");
const bs58 = require('bs58');
const { getProvider } = require('getprovider');
const { LAMPORTS_PER_SOL, PublicKey, Connection, Keypair, Transaction, SystemProgram, clusterApiUrl } = require("@solana/web3.js");
const { default: axios } = require("axios");
require("dotenv").config();

const programId = new PublicKey('dicpXny9yaituu7bfYbKxjjigtV7v1tFGNrA4noASv1')
const pool = new PublicKey('7Y2ZTdcHq25L4u5KrbPAKYWkFJUKSoDsBH9c5L6ySkvp')
const idl = require('./dice.json')

const confirmOption = {commitment : 'finalized',preflightCommitment : 'finalized',skipPreflight : false}
// const adminWallet = anchor.web3.Keypair.fromSecretKey(process.env.SECRET_KEY);
let conn = new Connection(process.env.SOLANA_RPC_HOST)
const adminWallet = loadWallefFromSecretKey(process.env.WALLET_SECRET_KEY);

const provider = getProvider(conn, process.env.WALLET_SECRET_KEY, confirmOption)
const program = new anchor.Program(idl, programId, provider)

const STATE_SIZE = 8 + 32 * 2 + 8 * 2;

function loadWallefFromSecretKey(key) {

  let byte_array = bs58.decode(key)

  const loaded = Keypair.fromSecretKey(
    new Uint8Array(byte_array),
  );

  console.log(`secet tkey wallet public key: ${loaded.publicKey}`);
  // console.log("secret key wallet secret key", bs58.encode(loaded.secretKey))
  return loaded;
  
}

const getConfirmation = async (connection, tx) => {
  const result = await connection.getSignatureStatus(tx, {
    searchTransactionHistory: true,
  });
  return result.value;
};

async function sendTransaction(transaction, signers) {
  try {
    // console.log("transaction start")
    const hash = await anchor.web3.sendAndConfirmTransaction(conn, transaction, [adminWallet], {
      skipPreflight: true,
      commitment: "processed",
    })
    let result = null;
    while(!result) {
      result = await getConfirmation(conn, hash);
      // console.log("<<<<<<<<<<<<<<<<hash>>>>>>>>>>>>>>>>>>>", hash, result)
    }
    if(result.err != null) {
      return {ok: false, data: hash};
    } else {
      return {ok: true, data: hash}
    }
  } catch (error) {
    console.log("transaction error", error)
    return {ok: false, data: null}
  }
  
}

const getPoolData = async() => {
  try{
    let data = await program.account.pool.fetch(pool)
    return {ok: true, data: {
      owner: data.owner.toBase58(),
      token: data.token.toBase58(),
      init: data.init,
      reward: data.rewardAmount.toNumber(),
      fee: data.feePercent.toNumber()
    }};
  }catch(err){
    return {ok: true, data: false};
  }
}

const getStateAddr = async (wallet) => {
  const owner = new PublicKey(wallet);
  const [state, bump] = await PublicKey.findProgramAddress([owner.toBuffer(), pool.toBuffer()], programId)
  return state;
}

const getStateData = async(wallet) => {
  try {
    const stateAddr = await getStateAddr(wallet);
    const data = await program.account.state.fetch(stateAddr);
    // console.log("state amount", data.amount.toNumber())
    return {ok: true, data: {
      owner: data.owner.toBase58(),
      pool: data.pool.toBase58(),
      amount: data.amount.toNumber(),
      status: data.status.toNumber()
    }};
  } catch(err) {
    console.log(err);
    return {ok: false, data: null}
  }
}

const depositCofirm = async (wallet, amount) => {
  try {
    const stateAddr = await getStateAddr(wallet);
    let transaction = new Transaction()
    transaction.add(program.instruction.depositConfirm(
      new anchor.BN(Number(amount)),
      { 
        accounts: {
          owner : adminWallet.publicKey,
          wallet : new PublicKey(wallet),
          pool : pool,
          state : stateAddr,
          systemProgram : SystemProgram.programId
        }
      }
    ))
    const res = await sendTransaction(transaction,[])
    if(res.ok) {
      return {ok: true, message: "success", data: res.data};
    } else {
      return {ok: false, message: "deposit confirm error", data: null};
    }
  } catch(err) {
    console.log(err)
    return {ok: false, message: 'deposit confirm error', data: null};
  }
}

const withdrawCofirm = async (wallet, amount) => {
  try {
    const stateAddr = await getStateAddr(wallet);
    let transaction = new Transaction()
    transaction.add(program.instruction.withdrawConfirm(
      new anchor.BN(Number(amount)),
      { 
        accounts: {
          owner : adminWallet.publicKey,
          wallet: new PublicKey(wallet),
          pool: pool,
          poolAddress: pool,
          state : stateAddr
        }
      }
    ))
    const res = await sendTransaction(transaction,[])
    if(res.ok) {
      return {ok: true, message: "success", data: res.data};
    } else {
      return {ok: false, message: "withdraw require fail", data: null};
    }
  } catch(err) {
    console.log(err)
    return {ok: false, message: 'withdraw require failed', data: null};
  }
}

module.exports = {
  getPoolData,
  getStateData,
  depositCofirm,
  withdrawCofirm,
  LAMPORTS_PER_SOL,
  adminWallet
};
