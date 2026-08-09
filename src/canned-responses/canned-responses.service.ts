import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CannedResponse } from './canned-response.entity';
import { newId } from '../common/ids';

@Injectable()
export class CannedResponsesService {
  constructor(
    @InjectRepository(CannedResponse)
    private readonly repo: Repository<CannedResponse>,
  ) {}

  async create(input: { title?: string; body?: string }): Promise<CannedResponse> {
    const title = input.title?.trim();
    if (!title) {
      throw new BadRequestException('title must be a non-empty string');
    }
    const body = input.body?.trim();
    if (!body) {
      throw new BadRequestException('body must be a non-empty string');
    }
    const existing = await this.repo.find();
    if (existing.some((c) => c.title.toLowerCase() === title.toLowerCase())) {
      throw new BadRequestException(`title '${title}' already exists`);
    }
    const created = this.repo.create({ id: newId('cnd'), title, body });
    return this.repo.save(created);
  }

  async findAll(): Promise<CannedResponse[]> {
    const all = await this.repo.find();
    return all.sort((a, b) => a.title.localeCompare(b.title));
  }

  async findById(id: string): Promise<CannedResponse | null> {
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException(`canned response ${id} not found`);
    }
    await this.repo.remove(existing);
  }
}
