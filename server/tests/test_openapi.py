# ABOUTME: Tests for OpenAPI documentation generation and content
# ABOUTME: Verifies that OpenAPI schema is properly generated and contains expected endpoints

import pytest
from fastapi.testclient import TestClient

from src.main import app


client = TestClient(app)


def test_openapi_json_endpoint():
    """Test that OpenAPI JSON endpoint returns 200 and valid content."""
    response = client.get("/v1/openapi.json")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"

    data = response.json()

    # Check basic OpenAPI structure
    assert "openapi" in data
    assert "info" in data
    assert "paths" in data
    assert "components" in data


def test_openapi_contains_required_endpoints():
    """Test that OpenAPI schema contains all expected endpoints."""
    response = client.get("/v1/openapi.json")
    data = response.json()

    paths = data["paths"]

    # Check that all expected endpoints are present
    expected_endpoints = [
        "/v1/healthz",
        "/v1/teams/{team}/posts",
        "/v1/teams/{team}/posts/{post_id}",
    ]

    for endpoint in expected_endpoints:
        assert endpoint in paths, f"Expected endpoint {endpoint} not found in OpenAPI spec"


def test_openapi_posts_endpoints_methods():
    """Test that posts endpoints have correct HTTP methods."""
    response = client.get("/v1/openapi.json")
    data = response.json()

    paths = data["paths"]

    # Check posts list endpoint
    posts_list = paths["/v1/teams/{team}/posts"]
    assert "get" in posts_list, "GET method missing from posts list endpoint"
    assert "post" in posts_list, "POST method missing from posts list endpoint"

    # Check single post endpoint
    single_post = paths["/v1/teams/{team}/posts/{post_id}"]
    assert "get" in single_post, "GET method missing from single post endpoint"
    assert "delete" in single_post, "DELETE method missing from single post endpoint"


def test_openapi_info_section():
    """Test that OpenAPI info section contains expected metadata."""
    response = client.get("/v1/openapi.json")
    data = response.json()

    info = data["info"]

    assert info["title"] == "MCP Social Media API"
    assert info["version"] == "1.0.0"
    assert "description" in info
    assert len(info["description"]) > 0
    assert "contact" in info
    assert "license" in info


def test_openapi_contains_error_schemas():
    """Test that OpenAPI schema includes error response models."""
    response = client.get("/v1/openapi.json")
    data = response.json()

    components = data["components"]
    assert "schemas" in components

    schemas = components["schemas"]

    # Check for error-related schemas
    assert "ErrorResponse" in schemas, "ErrorResponse schema not found"
    assert "ErrorEnvelope" in schemas, "ErrorEnvelope schema not found"

    # Check ErrorResponse structure
    error_response = schemas["ErrorResponse"]
    assert "properties" in error_response
    assert "detail" in error_response["properties"]


def test_openapi_contains_post_schemas():
    """Test that OpenAPI schema includes post-related models."""
    response = client.get("/v1/openapi.json")
    data = response.json()

    schemas = data["components"]["schemas"]

    # Check for post-related schemas
    expected_schemas = ["PostCreate", "RemotePost", "PostResponse", "PostsResponse", "HealthResponse"]

    for schema_name in expected_schemas:
        assert schema_name in schemas, f"Schema {schema_name} not found in OpenAPI spec"


def test_openapi_posts_endpoint_responses():
    """Test that posts endpoints have proper response definitions."""
    response = client.get("/v1/openapi.json")
    data = response.json()

    paths = data["paths"]

    # Check GET posts list endpoint responses
    get_posts = paths["/v1/teams/{team}/posts"]["get"]
    responses = get_posts["responses"]

    # Should have success and error responses
    assert "200" in responses
    assert "401" in responses
    assert "403" in responses
    assert "422" in responses
    assert "429" in responses

    # Check POST posts endpoint responses
    post_posts = paths["/v1/teams/{team}/posts"]["post"]
    post_responses = post_posts["responses"]

    assert "201" in post_responses
    assert "401" in post_responses
    assert "403" in post_responses
    assert "404" in post_responses
    assert "422" in post_responses
    assert "429" in post_responses


def test_openapi_parameter_descriptions():
    """Test that endpoint parameters have proper descriptions."""
    response = client.get("/v1/openapi.json")
    data = response.json()

    paths = data["paths"]

    # Check GET posts parameters
    get_posts = paths["/v1/teams/{team}/posts"]["get"]
    parameters = get_posts["parameters"]

    # Find team parameter
    team_param = next((p for p in parameters if p["name"] == "team"), None)
    assert team_param is not None, "Team parameter not found"
    assert "description" in team_param["schema"]

    # Find limit parameter
    limit_param = next((p for p in parameters if p["name"] == "limit"), None)
    assert limit_param is not None, "Limit parameter not found"
    assert "description" in limit_param["schema"]


def test_openapi_schema_examples():
    """Test that schemas include examples for better documentation."""
    response = client.get("/v1/openapi.json")
    data = response.json()

    schemas = data["components"]["schemas"]

    # Check that PostCreate has an example
    post_create = schemas["PostCreate"]
    # Examples can be in different locations depending on Pydantic version
    has_example = (
        "example" in post_create
        or ("examples" in post_create and len(post_create["examples"]) > 0)
        or any("example" in prop for prop in post_create.get("properties", {}).values())
    )
    assert has_example, "PostCreate schema should have examples"


def test_docs_endpoint_accessible():
    """Test that the Swagger UI docs endpoint is accessible."""
    response = client.get("/v1/docs")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]

    # Check that it's actually the Swagger UI page
    content = response.text
    assert "swagger" in content.lower() or "openapi" in content.lower()


def test_redoc_endpoint_accessible():
    """Test that the ReDoc endpoint is accessible."""
    response = client.get("/v1/redoc")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]

    # Check that it's actually the ReDoc page
    content = response.text
    assert "redoc" in content.lower()


def test_openapi_tags():
    """Test that endpoints are properly tagged for organization."""
    response = client.get("/v1/openapi.json")
    data = response.json()

    paths = data["paths"]

    # Check that health endpoint has Health tag
    health_endpoint = paths["/v1/healthz"]["get"]
    assert "tags" in health_endpoint
    assert "Health" in health_endpoint["tags"]

    # Check that posts endpoints have Posts tag (via router)
    posts_endpoint = paths["/v1/teams/{team}/posts"]["get"]
    assert "tags" in posts_endpoint
    assert "Posts" in posts_endpoint["tags"]


def test_openapi_security_requirements():
    """Test that endpoints properly define security requirements."""
    response = client.get("/v1/openapi.json")
    data = response.json()

    paths = data["paths"]

    # Health endpoint should not require security
    health_endpoint = paths["/v1/healthz"]["get"]
    # If security is not defined or is an empty list, no auth required
    security = health_endpoint.get("security", [])
    assert len(security) == 0 or security == [
        {}
    ], "Health endpoint should not require authentication"


def test_openapi_schema_field_names():
    """Test that schemas have the correct field names matching the new API structure."""
    response = client.get("/v1/openapi.json")
    data = response.json()

    schemas = data["components"]["schemas"]

    # Check PostCreate schema fields
    post_create = schemas["PostCreate"]
    post_create_props = post_create["properties"]
    assert "author" in post_create_props, "PostCreate should have 'author' field"
    assert "content" in post_create_props, "PostCreate should have 'content' field"
    assert "tags" in post_create_props, "PostCreate should have 'tags' field"
    assert "parentPostId" in post_create_props, "PostCreate should have 'parentPostId' field"

    # Check RemotePost schema fields
    remote_post = schemas["RemotePost"]
    remote_post_props = remote_post["properties"]
    assert "postId" in remote_post_props, "RemotePost should have 'postId' field"
    assert "author" in remote_post_props, "RemotePost should have 'author' field"
    assert "content" in remote_post_props, "RemotePost should have 'content' field"
    assert "tags" in remote_post_props, "RemotePost should have 'tags' field"
    assert "parentPostId" in remote_post_props, "RemotePost should have 'parentPostId' field"
    assert "createdAt" in remote_post_props, "RemotePost should have 'createdAt' field"

    # Check PostResponse schema fields
    post_response = schemas["PostResponse"]
    post_response_props = post_response["properties"]
    assert "postId" in post_response_props, "PostResponse should have 'postId' field"
    assert "author" in post_response_props, "PostResponse should have 'author' field"
    assert "content" in post_response_props, "PostResponse should have 'content' field"
    assert "tags" in post_response_props, "PostResponse should have 'tags' field"
    assert "parentPostId" in post_response_props, "PostResponse should have 'parentPostId' field"
    assert "createdAt" in post_response_props, "PostResponse should have 'createdAt' field"

    # Check PostsResponse schema fields
    posts_response = schemas["PostsResponse"]
    posts_response_props = posts_response["properties"]
    assert "posts" in posts_response_props, "PostsResponse should have 'posts' field"
    assert "nextOffset" in posts_response_props, "PostsResponse should have 'nextOffset' field"

    # Verify old field names are NOT present in new schemas
    assert "author_name" not in remote_post_props, "RemotePost should not have 'author_name' field"
    assert "parent_post_id" not in remote_post_props, "RemotePost should not have 'parent_post_id' field"
    assert "id" not in remote_post_props, "RemotePost should not have 'id' field"
    assert "timestamp" not in remote_post_props, "RemotePost should not have 'timestamp' field"
    assert "deleted" not in remote_post_props, "RemotePost should not have 'deleted' field"
    assert "team_name" not in remote_post_props, "RemotePost should not have 'team_name' field"
    assert "total" not in posts_response_props, "PostsResponse should not have 'total' field"
    assert "has_more" not in posts_response_props, "PostsResponse should not have 'has_more' field"
