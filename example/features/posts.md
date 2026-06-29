# posts

A simple blog: anyone can publish a post and anyone can comment on it.

## Stories

- See a list of posts, newest context first, each showing its title, author, and body.
- Create a post with a title, body, and author name.
- Read a post together with all of its comments.
- Add a comment to a post with an author name and body.
- Delete a post.
- Delete a comment.

## Models

### Post

- `title` — text, required
- `body` — text, required
- `author` — text, required
- `createdAt` — datetime, set on create

### Comment

- `postId` — reference to Post, required
- `author` — text, required
- `body` — text, required
- `createdAt` — datetime, set on create

<!-- "A user is anyone" for now (REQUIREMENTS.md §2): the author is a free-text
     name, no accounts. A Comment belongs to a Post via postId — the runtime reads
     this relationship from the models above (see src/schema.ts) to render each post
     as a card with its own nested comment list. -->
