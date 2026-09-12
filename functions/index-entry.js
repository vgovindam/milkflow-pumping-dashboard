'use strict';

const base=require('./index');
Object.assign(exports,base);

const {onRequest}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const admin=require('firebase-admin');
const {createFamilyChat}=require('./family-chat');

const db=admin.firestore();
const OPENAI_API_KEY=defineSecret('OPENAI_API_KEY');
const ALLOWED_ORIGINS=new Set([
  'https://vgovindam.github.io',
  'http://localhost:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173'
]);

exports.familyChat=createFamilyChat({onRequest,admin,db,OPENAI_API_KEY,ALLOWED_ORIGINS});
