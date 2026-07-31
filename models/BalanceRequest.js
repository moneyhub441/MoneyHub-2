const mongoose = require("mongoose");

const BalanceRequestSchema =
new mongoose.Schema({

 userId:{
  type:mongoose.Schema.Types.ObjectId,
  ref:"User",
  required:true
 },

 amount:{
  type:Number,
  required:true
 },

 orderId:{
  type:String,
  required:true,
  unique:true
 },

 status:{
  type:String,
  enum:[
   "Pending",
   "Approved",
   "Rejected"
  ],
  default:"Pending"
 },

 createdAt:{
  type:Date,
  default:Date.now
 }

});


module.exports =
mongoose.model(
 "BalanceRequest",
 BalanceRequestSchema
);