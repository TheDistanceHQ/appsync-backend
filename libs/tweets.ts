import { DynamoDB } from 'aws-sdk';
const DocumentClient = new DynamoDB.DocumentClient();

const { TWEETS_TABLE } = process.env;

export const getTweetById = async (tweetId: string) => {
  const resp = await DocumentClient.get({
    TableName: TWEETS_TABLE?TWEETS_TABLE: "",
    Key: {
      id: tweetId
    }
  }).promise()

  return resp.Item;
}

export const extractHashTags = (text: string) => {
  const hashTags = new Set();
  let m;
  const regex = /(\#[a-zA-Z0-9_]+\b)/gm
  while ((m = regex.exec(text)) !== null) {
    // this is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++
    }

    m.forEach(match => hashTags.add(match))
  }

  return Array.from(hashTags)
}

export const extractMentions = (text: string) => {
  const mentions = new Set()
  const regex = /@\w+/gm
  let m;
  while ((m = regex.exec(text)) !== null) {
    // this is necessary to avoid infinite loops with zero-width matches
    if (m.index === regex.lastIndex) {
      regex.lastIndex++
    }

    m.forEach(match => mentions.add(match))
  }

  return Array.from(mentions)
}