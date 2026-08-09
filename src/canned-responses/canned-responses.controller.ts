import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CannedResponsesService } from './canned-responses.service';

@Controller('canned-responses')
export class CannedResponsesController {
  constructor(private readonly cannedResponses: CannedResponsesService) {}

  @Get()
  findAll() {
    return this.cannedResponses.findAll();
  }

  @Post()
  create(@Body() body: { title?: string; body?: string }) {
    return this.cannedResponses.create(body ?? {});
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cannedResponses.remove(id);
  }
}
