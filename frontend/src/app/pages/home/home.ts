import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

import { TopbarComponent } from '../../components/topbar';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, TopbarComponent],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class HomeComponent {}
