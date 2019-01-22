/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as Octokit from '@octokit/rest';
import { IAccount, PullRequest } from './interface';
import { Comment } from '../common/comment';
import { parseDiffHunk, DiffHunk } from '../common/diffHunk';
import * as Common from '../common/timelineEvent';
import * as GraphQL from './graphql';

export function convertRESTUserToAccount(user: Octokit.PullRequestsGetAllResponseItemUser): IAccount {
	return {
		login: user.login,
		url: user.html_url,
		avatarUrl: user.avatar_url
	};
}

export function convertRESTHeadToIGitHubRef(head: Octokit.PullRequestsGetResponseHead) {
	return {
		label: head.label,
		ref: head.ref,
		sha: head.sha,
		repo: { cloneUrl: head.repo.clone_url }
	};
}

export function convertRESTPullRequestToRawPullRequest(pullRequest: Octokit.PullRequestsCreateResponse | Octokit.PullRequestsGetResponse | Octokit.PullRequestsGetAllResponseItem): PullRequest {
	let {
		number,
		body,
		title,
		html_url,
		user,
		state,
		assignee,
		created_at,
		updated_at,
		head,
		base,
		labels,
		node_id
	} = pullRequest;

	const item: PullRequest = {
			number,
			body,
			title,
			url: html_url,
			user: convertRESTUserToAccount(user),
			state,
			merged: (pullRequest as Octokit.PullRequestsGetResponse).merged || false,
			assignee: assignee ? convertRESTUserToAccount(assignee) : null,
			createdAt: created_at,
			updatedAt: updated_at,
			head: convertRESTHeadToIGitHubRef(head),
			base: convertRESTHeadToIGitHubRef(base),
			labels,
			mergeable: (pullRequest as Octokit.PullRequestsGetResponse).mergeable,
			nodeId: node_id
	};

	return item;
}

export function parseCommentDiffHunk(comment: Comment): DiffHunk[] {
	let diffHunks = [];
	let diffHunkReader = parseDiffHunk(comment.diffHunk);
	let diffHunkIter = diffHunkReader.next();

	while (!diffHunkIter.done) {
		let diffHunk = diffHunkIter.value;
		diffHunks.push(diffHunk);
		diffHunkIter = diffHunkReader.next();
	}

	return diffHunks;
}

export function convertIssuesCreateCommentResponseToComment(comment: Octokit.IssuesCreateCommentResponse | Octokit.IssuesEditCommentResponse): Comment {
	return {
		url: comment.url,
		id: comment.id,
		diffHunk: '',
		diffHunks: [],
		path: null,
		position: null,
		commitId: null,
		originalPosition: null,
		originalCommitId: null,
		user: convertRESTUserToAccount(comment.user),
		body: comment.body,
		createdAt: comment.created_at,
		htmlUrl: comment.html_url,
		graphNodeId: comment.node_id
	};
}

export function convertPullRequestsGetCommentsResponseItemToComment(comment: Octokit.PullRequestsGetCommentsResponseItem | Octokit.PullRequestsEditCommentResponse): Comment {
	let ret: Comment = {
		url: comment.url,
		id: comment.id,
		pullRequestReviewId: comment.pull_request_review_id,
		diffHunk: comment.diff_hunk,
		path: comment.path,
		position: comment.position,
		commitId: comment.commit_id,
		originalPosition: comment.original_position,
		originalCommitId: comment.original_commit_id,
		user: convertRESTUserToAccount(comment.user),
		body: comment.body,
		createdAt: comment.created_at,
		htmlUrl: comment.html_url,
		graphNodeId: comment.node_id
	};

	let diffHunks = parseCommentDiffHunk(ret);
	ret.diffHunks = diffHunks;
	return ret;
}

export function convertGraphQLEventType(text: string) {
	switch (text) {
		case 'Commit':
			return Common.EventType.Committed;
		case 'LabeledEvent':
			return Common.EventType.Labeled;
		case 'MilestonedEvent':
			return Common.EventType.Milestoned;
		case 'AssignedEvent':
			return Common.EventType.Assigned;
		case 'IssueComment':
			return Common.EventType.Commented;
		case 'PullRequestReview':
			return Common.EventType.Reviewed;
		case 'MergedEvent':
			return Common.EventType.Merged;

		default:
			return Common.EventType.Other;
	}
}

export function parseGraphQLComment(comment: GraphQL.ReviewComment): Comment {
	const c: Comment = {
		id: comment.databaseId,
		url: comment.url,
		body: comment.body,
		path: comment.path,
		canEdit: comment.viewerCanDelete,
		canDelete: comment.viewerCanDelete,
		pullRequestReviewId: comment.pullRequestReview && comment.pullRequestReview.databaseId,
		diffHunk: comment.diffHunk,
		position: comment.position,
		commitId: comment.commit.oid,
		originalPosition: comment.originalPosition,
		originalCommitId: comment.originalCommit && comment.originalCommit.oid,
		user: comment.author,
		createdAt: comment.createdAt,
		htmlUrl: comment.url,
		graphNodeId: comment.id,
		isDraft: comment.state === 'PENDING'
	};

	const diffHunks = parseCommentDiffHunk(c);
	c.diffHunks = diffHunks;

	return c;
}

export function parseGraphQLPullRequest(pullRequest: GraphQL.PullRequestResponse): PullRequest {
	const graphQLPullRequest = pullRequest.repository.pullRequest;
	return {
		url: graphQLPullRequest.url,
		number: graphQLPullRequest.number,
		state: graphQLPullRequest.state,
		body: graphQLPullRequest.body,
		bodyHTML: graphQLPullRequest.bodyHTML,
		title: graphQLPullRequest.title,
		createdAt: graphQLPullRequest.createdAt,
		updatedAt: graphQLPullRequest.updatedAt,
		head: graphQLPullRequest.headRef ? {
			label: graphQLPullRequest.headRef.name,
			ref: graphQLPullRequest.headRef.repository.nameWithOwner,
			sha: graphQLPullRequest.headRef.target.oid,
			repo: {
				cloneUrl: graphQLPullRequest.headRef.repository.url
			}
		} : undefined,
		base: graphQLPullRequest.baseRef ? {
			label: graphQLPullRequest.baseRef.name,
			ref: graphQLPullRequest.baseRef.repository.nameWithOwner,
			sha: graphQLPullRequest.baseRef.target.oid,
			repo: {
				cloneUrl: graphQLPullRequest.baseRef.repository.url
			}
		} : undefined,
		user: graphQLPullRequest.author,
		merged: graphQLPullRequest.merged,
		mergeable: graphQLPullRequest.mergeable,
		nodeId: graphQLPullRequest.id,
		labels: []
	};
}

export function parseGraphQLTimelineEvents(events: (GraphQL.MergedEvent | GraphQL.Review | GraphQL.IssueComment | GraphQL.Commit | GraphQL.AssignedEvent)[]): Common.TimelineEvent[] {
	let ret: Common.TimelineEvent[] = [];
	events.forEach(event => {
		let type = convertGraphQLEventType(event.__typename);

		switch (type) {
			case Common.EventType.Commented:
				let commentEvent = event as GraphQL.IssueComment;
				ret.push({
					htmlUrl: commentEvent.url,
					body: commentEvent.body,
					bodyHTML: commentEvent.bodyHTML,
					user: commentEvent.author,
					event: type,
					canEdit: commentEvent.viewerCanUpdate,
					canDelete: commentEvent.viewerCanDelete,
					id: commentEvent.databaseId,
					createdAt: commentEvent.createdAt
				} as Common.CommentEvent);
				return;
			case Common.EventType.Reviewed:
				let reviewEvent = event as GraphQL.Review;
				ret.push({
					event: type,
					comments: [],
					submittedAt: reviewEvent.submittedAt,
					body: reviewEvent.body,
					bodyHTML: reviewEvent.bodyHTML,
					htmlUrl: reviewEvent.url,
					user: reviewEvent.author,
					authorAssociation: reviewEvent.authorAssociation,
					state: reviewEvent.state,
					id: reviewEvent.databaseId,
				} as Common.ReviewEvent);
				return;
			case Common.EventType.Committed:
				let commitEv = event as GraphQL.Commit;
				ret.push({
					event: type,
					sha: commitEv.oid,
					author: commitEv.author.user || { login: commitEv.committer.name, avatarUrl: commitEv.committer.avatarUrl },
					htmlUrl: commitEv.url,
					message: commitEv.message
				} as Common.CommitEvent);
				return;
			case Common.EventType.Merged:
				let mergeEv = event as GraphQL.MergedEvent;

				ret.push({
					event: type,
					user: mergeEv.actor,
					createdAt: mergeEv.createdAt,
					mergeRef: mergeEv.mergeRef.name,
					sha: mergeEv.commit.oid,
					commitUrl: mergeEv.commit.commitUrl,
					url: mergeEv.url,
					graphNodeId: mergeEv.id
				} as Common.MergedEvent);
				return;
			case Common.EventType.Assigned:
				let assignEv = event as GraphQL.AssignedEvent;

				ret.push({
					event: type,
					user: assignEv.user,
					actor: assignEv.actor
				} as Common.AssignEvent);
				return;
			default:
				break;
		}
	});

	return ret;
}

export function convertRESTTimelineEvents(events: any[]): Common.TimelineEvent[] {
	events.forEach(event => {
		if (event.event === Common.EventType.Commented) {

		}

		if (event.event === Common.EventType.Reviewed) {
			event.submittedAt = event.submitted_at;
			event.htmlUrl = event.html_url;
		}

		if (event.event === Common.EventType.Committed) {
			event.htmlUrl = event.html_url;
		}
	});

	return events;
}