import _  from 'lodash';
import DynamoDB  from 'aws-sdk/clients/dynamodb';
const DocumentClient = new DynamoDB.DocumentClient();
import { TweetTypes, BatchSize } from '../libs/constants';

const { TWEETS_TABLE, TIMELINES_TABLE, MAX_TWEETS } = process.env

const MaxTweets = parseInt(MAX_TWEETS||"100");

export const handler = async (event:any) => {
  for (const record of event.Records) {
    if (record.eventName === 'INSERT') {
      const relationship = DynamoDB.Converter.unmarshall(record.dynamodb.NewImage)

      const [relType] = relationship.sk.split('_')
      if (relType === 'FOLLOWS') {
        const tweets = await getTweets(relationship.otherUserId)
        await distribute(tweets, relationship.userId)
      }
    } else if (record.eventName === 'REMOVE') {
      const relationship = DynamoDB.Converter.unmarshall(record.dynamodb.OldImage)

      const [relType] = relationship.sk.split('_')
      if (relType === 'FOLLOWS') {
        const tweets = await getTimelineEntriesBy(relationship.otherUserId, relationship.userId)
        await undistribute(tweets, relationship.userId)
      }
    }
  }
}

async function getTweets(userId:string) {
  const loop:any = async (acc:any, exclusiveStartKey:any) => {
    const resp = await DocumentClient.query({
      TableName: TWEETS_TABLE||"",
      KeyConditionExpression: 'creator = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      IndexName: 'byCreator',
      ExclusiveStartKey: exclusiveStartKey
    }).promise()
  
    const tweets = resp.Items || []
    const newAcc = acc.concat(tweets)

    if (resp.LastEvaluatedKey && newAcc.length < MaxTweets) {
      return await loop(newAcc, resp.LastEvaluatedKey)
    } else {
      return newAcc
    }
  }

  return await loop([])
}

async function getTimelineEntriesBy(distributedFrom:string, userId:string) {
  const loop:any = async (acc:any, exclusiveStartKey:any) => {
    const resp = await DocumentClient.query({
      TableName: TIMELINES_TABLE||"",
      KeyConditionExpression: 'userId = :userId AND distributedFrom = :distributedFrom',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':distributedFrom': distributedFrom,
      },
      IndexName: 'byDistributedFrom',
      ExclusiveStartKey: exclusiveStartKey
    }).promise()
  
    const tweets = resp.Items || []
    const newAcc = acc.concat(tweets)

    if (resp.LastEvaluatedKey) {
      return await loop(newAcc, resp.LastEvaluatedKey)
    } else {
      return newAcc
    }
  }

  return await loop([])
}

async function distribute(tweets:[], userId:string) {
  const timelineEntries = tweets.map((tweet:any) => ({
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

async function undistribute(tweets:[], userId:string) {
  const timelineEntries = tweets.map((tweet:any) => ({
    DeleteRequest: {
      Key: {
        userId,
        tweetId: tweet.tweetId
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