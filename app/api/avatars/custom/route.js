import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/requireAuth';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

function getCustomDir() {
  return path.join(process.cwd(), 'public', 'avatars', 'custom');
}

export async function GET() {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  try {
    const customDir = getCustomDir();

    if (!fs.existsSync(customDir)) {
      return NextResponse.json({ avatars: [] });
    }

    const files = fs.readdirSync(customDir);
    const avatars = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return IMAGE_EXTENSIONS.includes(ext);
      })
      .map(file => `/avatars/custom/${file}`);

    return NextResponse.json({ avatars });
  } catch (error) {
    console.error("Failed to read custom avatars:", error);
    return NextResponse.json({ avatars: [] }, { status: 500 });
  }
}

export async function POST(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate type
    const ext = path.extname(file.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PNG, JPG, JPEG, WebP, SVG, GIF' }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 5MB.' }, { status: 400 });
    }

    const customDir = getCustomDir();
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${timestamp}_${safeName}`;
    const filePath = path.join(customDir, fileName);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const publicPath = `/avatars/custom/${fileName}`;
    return NextResponse.json({ success: true, path: publicPath });
  } catch (error) {
    console.error("Failed to upload avatar:", error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const gate = await requireAuth();
  if (gate instanceof NextResponse) return gate;
  try {
    const { path: avatarPath } = await request.json();
    if (!avatarPath || !avatarPath.startsWith('/avatars/custom/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const fileName = path.basename(avatarPath);
    const filePath = path.join(getCustomDir(), fileName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete avatar:", error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
