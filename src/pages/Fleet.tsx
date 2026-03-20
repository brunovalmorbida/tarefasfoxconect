import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, Wrench, FileText, LayoutDashboard, Car, DollarSign } from "lucide-react";
import FleetDashboard from "./fleet/FleetDashboard";
import FleetVehicles from "./fleet/FleetVehicles";
import FleetCheckins from "./fleet/FleetCheckins";
import FleetMaintenances from "./fleet/FleetMaintenances";
import FleetDocuments from "./fleet/FleetDocuments";
import FleetCosts from "./fleet/FleetCosts";

export default function Fleet() {
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Frota</h1>
        <p className="text-muted-foreground">Operação e acompanhamento da frota</p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="gap-1.5">
            <Car className="h-4 w-4" />
            <span className="hidden sm:inline">Veículos</span>
          </TabsTrigger>
          <TabsTrigger value="checkins" className="gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Check-ins</span>
          </TabsTrigger>
          <TabsTrigger value="maintenances" className="gap-1.5">
            <Wrench className="h-4 w-4" />
            <span className="hidden sm:inline">Manutenções</span>
          </TabsTrigger>
          <TabsTrigger value="costs" className="gap-1.5">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Custos</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Documentos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><FleetDashboard /></TabsContent>
        <TabsContent value="vehicles"><FleetVehicles /></TabsContent>
        <TabsContent value="checkins"><FleetCheckins /></TabsContent>
        <TabsContent value="maintenances"><FleetMaintenances /></TabsContent>
        <TabsContent value="costs"><FleetCosts /></TabsContent>
        <TabsContent value="documents"><FleetDocuments /></TabsContent>
      </Tabs>
    </div>
  );
}
