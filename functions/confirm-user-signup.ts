import DynamoDB  from 'aws-sdk/clients/dynamodb';
const { USERS_TABLE } = process.env;
const DocClient = new  DynamoDB.DocumentClient({region: process.env.AWS_REGION});

export const handler = async (event: any) => {
  if (event.triggerSource == 'PostConfirmation_ConfirmSignUp') {
    const user = {
      id: event.userName,
      name: event.request.userAttributes['name'],
      screenName: 'Test',
      createdAt: new Date().toJSON(),
      followersCount: 0,
      followingCount: 0
    }

    console.log({user})
    await DocClient.put({
      TableName: USERS_TABLE?USERS_TABLE:"",
      Item: user,
      ConditionExpression: 'attribute_not_exists(id)'
    }).promise()
    return event;
  } else {
    return;
  }
}

