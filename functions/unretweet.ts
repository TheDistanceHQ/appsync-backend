import DynamoDB  from 'aws-sdk/clients/dynamodb';
import  _  from 'lodash';
const DocumentClient = new DynamoDB.DocumentClient();

const { USERS_TABLE, TIMELINES_TABLE, TWEETS_TABLE, RETWEETS_TABLE } = process.env

export const handler = async (event:any) => {
  const { tweetId } = event.arguments
  const { username } = event.identity

  const getTweetResp = await DocumentClient.get({
    TableName: TWEETS_TABLE||"",
    Key: {
      id: tweetId
    }
  }).promise()

  const tweet = getTweetResp.Item
  if (!tweet) {
    throw new Error('Tweet is not found')
  }

  const queryResp = await DocumentClient.query({
    TableName: TWEETS_TABLE||"",
    IndexName: 'retweetsByCreator',
    KeyConditionExpression: 'creator = :creator AND retweetOf = :tweetId',
    ExpressionAttributeValues: {
      ':creator': username,
      ':tweetId': tweetId
    },
    Limit: 1
  }).promise()

  const retweet = _.get(queryResp, 'Items.0')
  
  if (!retweet) {
    throw new Error('Retweet not found')
  }

  const transactItems:any = [{
    Delete: {
      TableName: TWEETS_TABLE,
      Key: {
        id: retweet.id
      },
      ConditionExpression: 'attribute_exists(id)'
    }
  }, {
    Delete: {
      TableName: RETWEETS_TABLE,
      Key: {
        userId: username,
        tweetId
      },
      ConditionExpression: 'attribute_exists(tweetId)'
    }
  }, {
    Update: {
      TableName: TWEETS_TABLE,
      Key: {
        id: tweetId
      },
      UpdateExpression: 'ADD retweets :minusOne',
      ExpressionAttributeValues: {
        ':minusOne': -1
      },
      ConditionExpression: 'attribute_exists(id)'
    }
  }, {
    Update: {
      TableName: USERS_TABLE,
      Key: {
        id: username
      },
      UpdateExpression: 'ADD tweetsCount :minusOne',
      ExpressionAttributeValues: {
        ':minusOne': -1
      },
      ConditionExpression: 'attribute_exists(id)'
    }
  }]

  console.log(`creator: [${tweet.creator}]; username: [${username}]`)
  if (tweet.creator !== username) {
    transactItems.push({
      Delete: {
        TableName: TIMELINES_TABLE,
        Key: {
          userId: username,
          tweetId: retweet.id
        }
      }
    })
  }

  await DocumentClient.transactWrite({
    TransactItems: transactItems
  }).promise()

  return true
}