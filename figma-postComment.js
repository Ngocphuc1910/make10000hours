const Figma = require('figma-js');
const client = Figma.Client({personalAccessToken: 'figd__aBDQvK7c2PF_ZzR--K9HbZO5MZeBF1gTl4wEfre'});

async function postComment() {
  try {
    const result = await client.postComment({
      file_key: 'x3IL6tm3B2gEgpvC6WYiP3',
      message: "Please replace this frame with a Sessions List UI based on the design spec I'll share separately.",
      client_meta: {
        x: 0,
        y: 0
      }
    });
    
    console.log('Comment posted:', result.data);
  } catch (error) {
    console.error('Error posting comment:', error.response ? error.response.data : error);
  }
}

postComment(); 