import { Controller, Get } from '@nestjs/common';
import { TicketsService } from './tickets.service';

@Controller('tags')
export class TagsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll() {
    return this.ticketsService.findAllTagNames();
  }
}
