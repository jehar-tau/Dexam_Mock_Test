// Existing focused Community fixtures contain fewer than one page. Keep their
// DTO explicit while their tests concentrate on image/replay/report behavior.
export function communityFeedFixture(posts,input) {
  const filters={exam:input.p_exam??null,topic:input.p_topic??null};
  return {posts:posts.filter(post=>post.status!=="hidden"&&(!filters.exam||post.exam===filters.exam)&&(!filters.topic||post.topic===filters.topic))
    .map(post=>({createdAt:"2026-01-01T00:00:00.123456+00:00",author:"Student",status:"visible",comments:0,...post})),
    nextCursor:null,version:1,snapshotAt:"2026-01-02T00:00:00.654321+00:00",filters};
}
