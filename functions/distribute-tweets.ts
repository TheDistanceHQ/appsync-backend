import _  from 'lodash';
import DynamoDB  from 'aws-sdk/clients/dynamodb';
const DocumentClient = new DynamoDB.DocumentClient();
import { TweetTypes, BatchSize } from '../libs/constants';

const { RELATIONSHIPS_TABLE, TIMELINES_TABLE } = process.env

export const handler = async (event:any) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT') {
      const tweet = DynamoDB.Converter.unmarshall(record.dynamodb.NewImage)
      const followers = await getFollowers(tweet.creator)
      await distribute(tweet, followers)
    } else if (record.eventName === 'REMOVE') {
      const tweet = DynamoDB.Converter.unmarshall(record.dynamodb.OldImage)
      const followers = await getFollowers(tweet.creator)
      await undistribute(tweet, followers)
    }
  }
}

async function getFollowers(userId:string) {
  const loop :any = async (acc:any, exclusiveStartKey?:any) => {
    const resp = await DocumentClient.query({
      TableName: RELATIONSHIPS_TABLE||"",
      KeyConditionExpression: 'otherUserId = :otherUserId and begins_with(sk, :follows)',
      ExpressionAttributeValues: {
        ':otherUserId': userId,
        ':follows': 'FOLLOWS_'
      },
      IndexName: 'byOtherUser',
      ExclusiveStartKey: exclusiveStartKey
    }).promise()
  
    const userIds = (resp.Items || []).map(x => x.userId)

    if (resp.LastEvaluatedKey) {
      return await loop(acc.concat(userIds), resp.LastEvaluatedKey)
    } else {
      return acc.concat(userIds)
    }
  }

  return await loop([])
}

async function distribute(tweet:any, followers:[]) {
  const timelineEntries = followers.map(userId => ({
    PutRequest: {
      Item: {
        userId,
        tweetId: tweet.id,
        timestamp: tweet.createdAt,
        distributedFrom: tweet.creator,
        retweetOf: tweet.retweetOf,
        inReplyToTweetId: tweet.inReplyToTweetId,
        inReplyToUserIds: tweet.inReplyToUserIds
      }
    }
  }))

  const chunks = _.chunk(timelineEntries, BatchSize.MAX_BATCH_SIZE)

  const promises = chunks.map(async chunk => {
    await DocumentClient.batchWrite({
      RequestItems: {
        [TIMELINES_TABLE||""]: chunk
      }
    }).promise()
  })

  await Promise.all(promises)
}

async function undistribute(tweet:any, followers:[]) {
  const timelineEntries = followers.map(userId => ({
    DeleteRequest: {
      Key: {
        userId,
        tweetId: tweet.id
      }
    }
  }))

  const chunks = _.chunk(timelineEntries, BatchSize.MAX_BATCH_SIZE)

  const promises = chunks.map(async chunk => {
    await DocumentClient.batchWrite({
      RequestItems: {
        [TIMELINES_TABLE||""]: chunk
      }
    }).promise()
  })

  await Promise.all(promises)
}