"use client";

import { ClassList } from "@/components/academic/class-list";
import { SubjectList } from "@/components/academic/subject-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CoursesPage() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-orange-400 to-amber-200 bg-clip-text text-transparent">
					Academic Data
				</h2>
				<p className="text-zinc-400 mt-1">Manage classes and subjects.</p>
			</div>

			<Tabs defaultValue="classes" className="space-y-4">
				<TabsList className="bg-zinc-900 border border-zinc-800 text-zinc-400">
					<TabsTrigger
						value="classes"
						className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
					>
						Classes
					</TabsTrigger>
					<TabsTrigger
						value="subjects"
						className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
					>
						Subjects
					</TabsTrigger>
				</TabsList>
				<TabsContent value="classes">
					<ClassList />
				</TabsContent>
				<TabsContent value="subjects">
					<SubjectList />
				</TabsContent>
			</Tabs>
		</div>
	);
}
