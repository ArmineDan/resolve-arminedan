import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CannedResponsesService } from './canned-responses.service';
import { CannedResponse } from './canned-response.entity';

describe('CannedResponsesService', () => {
  let moduleRef: TestingModule;
  let service: CannedResponsesService;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          dropSchema: true,
          synchronize: true,
          entities: [CannedResponse],
        }),
        TypeOrmModule.forFeature([CannedResponse]),
      ],
      providers: [CannedResponsesService],
    }).compile();

    service = moduleRef.get(CannedResponsesService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  const valid = {
    title: 'Password reset',
    body: 'Please check your inbox for the reset link.',
  };

  it('AC-6: lists canned responses sorted by title', async () => {
    await service.create({
      title: 'Refund status',
      body: 'Your refund is processing.',
    });
    await service.create(valid);

    const list = await service.findAll();
    expect(list.map((c) => c.title)).toEqual(['Password reset', 'Refund status']);
  });

  it('AC-6: returns id, title, and body for each canned response', async () => {
    await service.create(valid);
    const [entry] = await service.findAll();
    expect(entry).toEqual(
      expect.objectContaining({ title: valid.title, body: valid.body }),
    );
    expect(entry.id).toEqual(expect.any(String));
  });

  it('AC-7: creates a canned response with the given title and body', async () => {
    const created = await service.create(valid);
    expect(created.title).toBe(valid.title);
    expect(created.body).toBe(valid.body);
  });

  it.each([
    [{ ...valid, title: '  ' }, 'title'],
    [{ ...valid, title: '' }, 'title'],
    [{ ...valid, body: '  ' }, 'body'],
    [{ ...valid, body: '' }, 'body'],
  ])('AC-7: rejects an empty/whitespace-only field, naming it', async (input, field) => {
    await expect(service.create(input)).rejects.toThrow(
      expect.objectContaining({ message: expect.stringContaining(field) }),
    );
  });

  it('AC-7: rejects a title that already exists (case-insensitive), naming the field', async () => {
    await service.create(valid);
    await expect(
      service.create({ ...valid, title: valid.title.toUpperCase() }),
    ).rejects.toThrow(
      expect.objectContaining({ message: expect.stringContaining('title') }),
    );
  });

  it('AC-8: deletes a canned response', async () => {
    const created = await service.create(valid);
    await service.remove(created.id);
    expect(await service.findAll()).toHaveLength(0);
  });

  it('AC-8: 404s deleting an unknown canned response', async () => {
    await expect(service.remove('cnd_missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
