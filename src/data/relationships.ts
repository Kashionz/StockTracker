import type { RelationshipLink } from "../types";

export const relationshipLinks: RelationshipLink[] = [
  {
    sourceSymbol: "NVDA",
    targetSymbol: "2330",
    relation: "AI 晶片需求拉動先進製程",
    impact: "positive"
  },
  {
    sourceSymbol: "NVDA",
    targetSymbol: "2382",
    relation: "AI 伺服器訂單外溢至組裝廠",
    impact: "positive"
  },
  {
    sourceSymbol: "NVDA",
    targetSymbol: "3231",
    relation: "AI 伺服器需求擴散至 ODM",
    impact: "positive"
  },
  {
    sourceSymbol: "NVDA",
    targetSymbol: "2308",
    relation: "高功耗伺服器推升電源與散熱需求",
    impact: "positive"
  },
  {
    sourceSymbol: "AAPL",
    targetSymbol: "2317",
    relation: "新品拉貨挹注組裝供應鏈",
    impact: "positive"
  },
  {
    sourceSymbol: "AAPL",
    targetSymbol: "2330",
    relation: "新品升級帶動先進製程投片",
    impact: "positive"
  },
  {
    sourceSymbol: "2330",
    targetSymbol: "3711",
    relation: "先進封裝與封測需求同步受惠",
    impact: "positive"
  },
  {
    sourceSymbol: "US_RATES_HAWKISH",
    targetSymbol: "NVDA",
    relation: "高利率壓抑高估值科技股",
    impact: "negative"
  },
  {
    sourceSymbol: "US_RATES_HAWKISH",
    targetSymbol: "TSLA",
    relation: "成長股評價面承壓",
    impact: "negative"
  },
  {
    sourceSymbol: "US_RATES_HAWKISH",
    targetSymbol: "AAPL",
    relation: "權值科技短線估值受壓",
    impact: "negative"
  }
];
