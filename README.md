# NestJS Social Media V1

This is a Social Media project that is researching best practices in NestJS development
<br>I took inspiration from the features of YouTube and Instagram
<br><br>(Work in progress; Direct messaging feature not yet implemented)

- REST API
- Swagger Document
- Postgres
- Image Uploading (Multipart)

- Authenication
- Feed
- Comments/Replies
- Follow
- Search Users
- REST API integration
  <br><br><br>

## Running locally

Requirements: Node.js 26 (see `.nvmrc`) and PostgreSQL.

```bash
npm ci                    # install exactly the locked dependencies
cp .env.example .env      # then fill in the values (DB, JWT_SECRET, SERVER_URL)
npm run migration:run     # create / update the database schema
npm run start:dev         # http://localhost:3001, Swagger at /api
```

`SERVER_URL` in `.env` is the address the Flutter app uses to reach this server
(e.g. your computer's IP on the local network); image URLs are built from it.

The database schema changes only through migrations; see
[`src/migrations/README.md`](src/migrations/README.md).
Tests: `npm test` (unit) and `npm run test:e2e` (see [`test/README.md`](test/README.md)).

<br><br>

## YouTube

- [YouTube demo video](https://www.youtube.com/watch?v=9e3alP88V7A)
  <br><br><br>

## Flutter Mobile Github Repository

- [Flutter Social Media V1](https://github.com/StephenLeeDev/FlutterSocialMediaV1)
  <br><br><br><br>

## Authentication

<img src="https://github.com/StephenLeeDev/NestjsSocialMediaV1/assets/57079969/2cf0f70d-b6fa-4d38-b0a5-6fc98e9b70ab" alt="Authentication">
<br><br><br>

## User

<img src="https://github.com/StephenLeeDev/NestjsSocialMediaV1/assets/57079969/74164403-850d-4e8e-a07e-deaf4745fcd2" alt="User">
<br><br><br>

## Post

<img src="https://github.com/StephenLeeDev/NestjsSocialMediaV1/assets/57079969/e3014429-30d3-4ed1-a5a7-9c617f4a9277" alt="Post">
<br><br><br>

## Comment

<img src="https://github.com/StephenLeeDev/NestjsSocialMediaV1/assets/57079969/1d2eab12-f730-4c11-82c5-389163fa9106" alt="Comment">
<br><br><br>

## Chat

<img src="https://github.com/StephenLeeDev/NestjsSocialMediaV1/assets/57079969/241a9cc8-7811-4b82-9247-623b8806f7ef" alt="Chat">
<br><br><br>

## Message

<img src="https://github.com/StephenLeeDev/NestjsSocialMediaV1/assets/57079969/11e6b5dd-5f32-4515-abc9-d8a20131648e" alt="Message">
<br><br><br>

## Follow

<img src="https://github.com/StephenLeeDev/NestjsSocialMediaV1/assets/57079969/d65f2159-463b-43cc-9787-daef91644e1a" alt="Follow">
<br><br><br>
