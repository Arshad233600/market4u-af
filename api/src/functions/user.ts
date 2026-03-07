
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db";
import { validateToken, authResponse } from "../utils/authUtils";
import * as sql from "mssql";

export async function getUserProfile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const auth = validateToken(request);
    const authErr = authResponse(auth);
    if (authErr) return authErr;

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("Id", sql.NVarChar, auth.userId)
            .query("SELECT Id, Name, Email, Phone, AvatarUrl, IsVerified, VerificationStatus, Role, CreatedAt FROM Users WHERE Id = @Id");

        if (result.recordset.length === 0) {
            return { status: 404, jsonBody: { message: "کاربر یافت نشد." } };
        }

        return {
            status: 200,
            jsonBody: result.recordset[0]
        };
    } catch (error) {
        context.error("Get Profile Error", error);
        return { status: 500, jsonBody: { message: "خطای سرور" } };
    }
}

export async function updateUserProfile(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const auth = validateToken(request);
    const authErr = authResponse(auth);
    if (authErr) return authErr;

    try {
        const body = await request.json() as any;
        const pool = await getPool();
        
        // Dynamic update query
        let query = "UPDATE Users SET ";
        const updates = [];
        if (body.name) updates.push("Name = @Name");
        if (body.email) updates.push("Email = @Email");
        if (body.avatarUrl !== undefined) updates.push("AvatarUrl = @AvatarUrl");
        // Phone is usually not updateable without verification
        
        if (updates.length === 0) return { status: 400, jsonBody: { error: "No fields to update" } };
        
        query += updates.join(", ") + " WHERE Id = @Id";

        const req = pool.request().input("Id", sql.NVarChar, auth.userId);
        if (body.name) req.input("Name", sql.NVarChar, body.name);
        if (body.email) req.input("Email", sql.NVarChar, body.email);
        if (body.avatarUrl !== undefined) req.input("AvatarUrl", sql.NVarChar, body.avatarUrl);

        await req.query(query);

        return { status: 200, jsonBody: { success: true } };
    } catch (error) {
        context.error("Update Profile Error", error);
        return { status: 500, jsonBody: { error: "Server Error" } };
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

export async function deleteAccount(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const auth = validateToken(request);
    const authErr = authResponse(auth);
    if (authErr) return authErr;

    try {
        const pool = await getPool();
        const deletedAt = new Date();

        // Soft-delete user's ads
        await pool.request()
            .input("UserId", sql.NVarChar, auth.userId)
            .input("DeletedAt", sql.DateTime, deletedAt)
            .query("UPDATE Ads SET IsDeleted = 1, DeletedAt = @DeletedAt WHERE UserId = @UserId AND IsDeleted = 0");

        // Soft-delete the user account
        await pool.request()
            .input("UserId", sql.NVarChar, auth.userId)
            .input("DeletedAt", sql.DateTime, deletedAt)
            .query("UPDATE Users SET IsDeleted = 1, DeletedAt = @DeletedAt WHERE Id = @UserId");

        context.log(`Account soft-deleted: ${auth.userId}`);
        return { status: 200, jsonBody: { success: true } };
    } catch (error) {
        context.error("Delete Account Error", error);
        return { status: 500, jsonBody: { message: "خطای سرور" } };
    }
}

app.http('deleteAccount', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'user/account',
    handler: deleteAccount
});

export async function searchUsers(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const auth = validateToken(request);
    const authErr = authResponse(auth);
    if (authErr) return authErr;

    const q = new URL(request.url).searchParams.get('q') ?? '';
    if (q.length < 2) {
        return { status: 200, jsonBody: [] };
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('Q', sql.NVarChar, `%${q}%`)
            .input('CurrentUserId', sql.NVarChar, auth.userId)
            .query(`
                SELECT TOP 10 u.Id, u.Name, latest_ad.Location AS Province
                FROM Users u
                LEFT JOIN (
                    SELECT UserId, Location,
                           ROW_NUMBER() OVER (PARTITION BY UserId ORDER BY CreatedAt DESC) AS rn
                    FROM Ads
                    WHERE IsDeleted = 0
                ) AS latest_ad ON latest_ad.UserId = u.Id AND latest_ad.rn = 1
                WHERE u.Name LIKE @Q
                  AND u.IsDeleted = 0
                  AND u.Id != @CurrentUserId
                ORDER BY u.Name
            `);

        return { status: 200, jsonBody: result.recordset };
    } catch (error) {
        context.error('searchUsers Error', error);
        return { status: 500, jsonBody: { message: 'خطای سرور' } };
    }
}

app.http('searchUsers', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'users/search',
    handler: searchUsers
});
