# We-Share

We-Share is a social media backend built with TypeScript, Apollo GraphQL, and Neo4j. It provides core social networking features such as following/unfollowing users, Tweeting, and liking/unliking content.

## What is We-Share?

We-Share is designed as a backend service for social media applications. It allows users to interact with each other through follows, posts (tweets), and likes. The backend leverages the power of Neo4j for graph-based data storage, making it efficient for social network operations and queries.

## Features

- **Follow/Unfollow:** Easily manage social connections between users.
- **Tweet:** Users can post short messages.
- **Like/Unlike:** Engage with posts by liking or unliking.

## How it Works

- The backend exposes a GraphQL API, accessible at: [https://we-share-api.onrender.com/graphql](https://we-share-api.onrender.com/graphql).
- Data is modeled and stored in Neo4j, making relationship queries fast and flexible.
- Operations such as following a user, posting a tweet, or liking content are handled through GraphQL mutations, while queries allow fetching user timelines, tweets, and relationship data.

## Technologies Used

- **TypeScript:** Strongly-typed backend logic.
- **Apollo GraphQL:** Flexible API for clients.
- **Neo4j:** Graph database for efficient relationship handling.

---

For more details on setup, contributing, or API documentation, please refer to the code or open an issue.
