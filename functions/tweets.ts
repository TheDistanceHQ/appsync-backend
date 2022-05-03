import DynamoDB  from 'aws-sdk/clients/dynamodb';
const DocumentClient = new DynamoDB.DocumentClient();
import * as ulid  from 'ulid';
import { TweetTypes } from '../libs/constants';
import { extractHashTags }  from '../libs/tweets';

const { USERS_TABLE, TIMELINES_TABLE, TWEETS_TABLE } = process.env

export const handler = async (event: any) => {
  const { text } = event.arguments
  const { username } = event.identity
  const id = ulid.ulid()
  const timestamp = new Date().toJSON()
  const hashTags = extractHashTags(text)

  const newTweet = {
    __typename: TweetTypes.TWEET,
    id,
    text,
    creator: username,
    createdAt: timestamp,
    replies: 0,
    likes: 0,
    retweets: 0
  }

  await DocumentClient.transactWrite({
    TransactItems: [{
      Put: {
        TableName: TWEETS_TABLE||"",
        Item: newTweet
      }
    }, {
      Put: {
        TableName: TIMELINES_TABLE||"",
        Item: {
          userId: username,
          tweetId: id,
          timestamp
        }
      }
    }, {
      Update: {
        TableName: USERS_TABLE||"",
        Key: {
          id: username
        },
        UpdateExpression: 'ADD tweetsCount :one',
        ExpressionAttributeValues: {
          ':one': 1
        },
        ConditionExpression: 'attribute_exists(id)'
      }
    }]
  }).promise()

  return newTweet
}