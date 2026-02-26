
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db";
import { validateToken } from "../utils/authUtils";
import * as sql from "mssql";

export async function getUserProfile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const auth = validateToken(request);
    if (!auth.isAuthenticated) {
        return { status: 401, body: JSON.stringify({ message: "لطفا وارد حساب کاربری شوید." }) };
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("Id", sql.NVarChar, auth.userId)
            .query("SELECT Id, Name, Email, Phone, AvatarUrl, IsVerified, Role, CreatedAt FROM Users WHERE Id = @Id");

        if (result.recordset.length === 0) {
            return { status: 404, body: JSON.stringify({ message: "کاربر یافت نشد." }) };
        }

        return {
            status: 200,
            jsonBody: result.recordset[0]
        };
    } catch (error) {
        context.error("Get Profile Error", error);
        return { status: 500, body: JSON.stringify({ message: "خطای سرور" }) };
    }
}

export async function updateUserProfile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const auth = validateToken(request);
    if (!auth.isAuthenticated) {
        return { status: 401, body: "Unauthorized" };
    }

    try {
        const body = await request.json() as any;
        const pool = await getPool();
        
        // Dynamic update query
        let query = "UPDATE Users SET ";
        const updates = [];
        if (body.name) updates.push("Name = @Name");
        if (body.email) updates.push("Email = @Email");
        // Phone is usually not updateable without verification
        
        if (updates.length === 0) return { status: 400, body: "No fields to update" };
        
        query += updates.join(", ") + " WHERE Id = @Id";

        const req = pool.request().input("Id", sql.NVarChar, auth.userId);
        if (body.name) req.input("Name", sql.NVarChar, body.name);
        if (body.email) req.input("Email", sql.NVarChar, body.email);

        await req.query(query);

        return { status: 200, body: JSON.stringify({ success: true }) };
    } catch (error) {
        context.error("Update Profile Error", error);
        return { status: 500, body: "Server Error" };
    }
}

export async function searchUsers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const auth = validateToken(request);
    if (!auth.isAuthenticated) {
        return { status: 401, body: JSON.stringify({ message: "لطفا وارد حساب کاربری شوید." }) };
    }

    const q = request.query.get('q') || '';
    if (!q.trim()) {
        return { status: 200, jsonBody: [] };
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("Q", sql.NVarChar, `%${q.trim()}%`)
            .input("CurrentUserId", sql.NVarChar, auth.userId)
            .query(`
                SELECT TOP 10 Id, Name, AvatarUrl
                FROM Users
                WHERE Name LIKE @Q
                  AND Id <> @CurrentUserId
                ORDER BY Name
            `);

        return { status: 200, jsonBody: result.recordset };
    } catch (error) {
        context.error("Search Users Error", error);
        return { status: 500, body: JSON.stringify({ message: "خطای سرور" }) };
    }
}

app.http('getUserProfile', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'user/profile',
    handler: getUserProfile
});

app.http('updateUserProfile', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'user/profile',
    handler: updateUserProfile
});

app.http('searchUsers', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'users/search',
    handler: searchUsers
});
